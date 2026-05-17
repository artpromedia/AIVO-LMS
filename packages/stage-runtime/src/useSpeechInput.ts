/**
 * useSpeechInput — React hook for capturing learner speech via Web Speech
 * API (preferred) or a MediaRecorder + /api/ai/transcribe fallback.
 *
 * Extracted from apps/web/src/components/stage/useSpeechInput.ts as part of
 * the §8 #2 Stage extraction (v2.1).
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechInputStatus = "idle" | "listening" | "processing" | "error";

export interface UseSpeechInputOptions {
  locale?: string;
  onResult?: (transcript: string) => void;
  onError?: (error: SpeechInputError) => void;
  maxDurationMs?: number;
  /**
   * Bearer token forwarded to /api/ai/transcribe. The endpoint requires a
   * signed-in user; without this the MediaRecorder fallback path will 401.
   */
  authToken?: string | null;
}

export type SpeechInputError =
  | "permission_denied"
  | "no_speech"
  | "unsupported"
  | "network"
  | "transcription_failed"
  | "audio_capture";

export interface SpeechInputApi {
  status: SpeechInputStatus;
  transcript: string;
  error: SpeechInputError | null;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const MAX_RECORDED_BYTES = 5 * 1024 * 1024;

function pickRecorderMime(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // older browsers
    }
  }
  return undefined;
}

function getWebSpeech(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return typeof window !== "undefined" ? window.btoa(binary) : "";
}

export function useSpeechInput(opts: UseSpeechInputOptions = {}): SpeechInputApi {
  const { locale = "en-US", onResult, onError, maxDurationMs = 20000, authToken } = opts;
  const [status, setStatus] = useState<SpeechInputStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<SpeechInputError | null>(null);

  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  const recorderSupported = typeof window !== "undefined"
    && typeof MediaRecorder !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia;
  const webSpeechSupported = !!getWebSpeech();
  const isSupported = webSpeechSupported || recorderSupported;

  const cleanupAudio = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAudio();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [cleanupAudio]);

  const safeSet = useCallback(<T,>(setter: (v: T) => void, v: T) => {
    if (mountedRef.current) setter(v);
  }, []);

  const fail = useCallback((kind: SpeechInputError) => {
    safeSet(setStatus, "error" as SpeechInputStatus);
    safeSet(setError, kind);
    onError?.(kind);
  }, [onError, safeSet]);

  const finish = useCallback((text: string) => {
    safeSet(setTranscript, text);
    safeSet(setStatus, "idle" as SpeechInputStatus);
    if (text) onResult?.(text);
    else onError?.("no_speech");
    if (!text) safeSet(setError, "no_speech" as SpeechInputError);
  }, [onError, onResult, safeSet]);

  const startWebSpeech = useCallback((): boolean => {
    const Ctor = getWebSpeech();
    if (!Ctor) return false;
    try {
      const rec = new Ctor();
      rec.lang = locale;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      let captured = "";
      rec.onresult = (event: any) => {
        const result = event.results?.[0]?.[0]?.transcript;
        if (typeof result === "string") captured = result.trim();
      };
      rec.onerror = (event: any) => {
        const code = event?.error;
        if (code === "not-allowed" || code === "service-not-allowed") fail("permission_denied");
        else if (code === "no-speech") fail("no_speech");
        else if (code === "network") fail("network");
        else fail("audio_capture");
      };
      rec.onend = () => {
        if (cancelledRef.current) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (status === "error") return;
        finish(captured);
      };
      recognitionRef.current = rec;
      cancelledRef.current = false;
      rec.start();
      safeSet(setStatus, "listening" as SpeechInputStatus);
      timeoutRef.current = setTimeout(() => {
        try { rec.stop(); } catch {}
      }, maxDurationMs);
      return true;
    } catch {
      return false;
    }
  }, [locale, maxDurationMs, fail, finish, safeSet, status]);

  const startRecorder = useCallback(async (): Promise<void> => {
    if (!recorderSupported) {
      fail("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") fail("permission_denied");
      else fail("audio_capture");
      return;
    }
    streamRef.current = stream;
    const mime = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      cleanupAudio();
      fail("unsupported");
      return;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];
    let recordedBytes = 0;
    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      chunksRef.current.push(e.data);
      recordedBytes += e.data.size;
      if (recordedBytes >= MAX_RECORDED_BYTES && recorder.state === "recording") {
        try { recorder.stop(); } catch {}
      }
    };
    recorder.onstop = async () => {
      const captured = chunksRef.current;
      chunksRef.current = [];
      cleanupAudio();
      if (cancelledRef.current) return;
      if (captured.length === 0) {
        finish("");
        return;
      }
      safeSet(setStatus, "processing" as SpeechInputStatus);
      const blob = new Blob(captured, { type: recorder.mimeType || mime || "audio/webm" });
      try {
        const audio_base64 = await blobToBase64(blob);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        const res = await fetch("/api/ai/transcribe", {
          method: "POST",
          headers,
          body: JSON.stringify({
            audio_base64,
            mime_type: blob.type,
            locale,
          }),
        });
        if (!res.ok) {
          // 401/403 are auth errors — keep them distinct so the UI can prompt
          // the learner to sign in again rather than retry the recording.
          if (res.status === 401 || res.status === 403) fail("permission_denied");
          else fail("transcription_failed");
          return;
        }
        if (cancelledRef.current || !mountedRef.current) return;
        const data = await res.json();
        if (cancelledRef.current || !mountedRef.current) return;
        finish(((data?.transcript as string) || "").trim());
      } catch {
        if (cancelledRef.current || !mountedRef.current) return;
        fail("transcription_failed");
      }
    };
    cancelledRef.current = false;
    try {
      recorder.start();
      safeSet(setStatus, "listening" as SpeechInputStatus);
    } catch {
      cleanupAudio();
      fail("audio_capture");
      return;
    }
    timeoutRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        try { recorderRef.current.stop(); } catch {}
      }
    }, maxDurationMs);
  }, [cleanupAudio, fail, finish, locale, maxDurationMs, recorderSupported, safeSet, authToken]);

  const start = useCallback(async () => {
    if (status === "listening" || status === "processing") return;
    safeSet(setError, null as SpeechInputError | null);
    safeSet(setTranscript, "");
    cancelledRef.current = false;
    if (startWebSpeech()) return;
    await startRecorder();
  }, [safeSet, startRecorder, startWebSpeech, status]);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (recorderRef.current && recorderRef.current.state === "recording") {
      try { recorderRef.current.stop(); } catch {}
    }
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    cleanupAudio();
    safeSet(setStatus, "idle" as SpeechInputStatus);
    safeSet(setError, null as SpeechInputError | null);
    safeSet(setTranscript, "");
  }, [cleanupAudio, safeSet]);

  return { status, transcript, error, isSupported, start, stop, reset };
}
