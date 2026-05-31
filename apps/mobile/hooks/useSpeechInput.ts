import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
// SDK 54 ships expo-file-system v19's "next-gen" File API by default;
// the back-compat readAsStringAsync used here lives at /legacy until we migrate.
import * as FileSystem from "expo-file-system/legacy";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export type SpeechInputStatus = "idle" | "listening" | "processing" | "error";

export type SpeechInputError =
  | "permission_denied"
  | "no_speech"
  | "unsupported"
  | "network"
  | "transcription_failed"
  | "audio_capture";

export interface UseSpeechInputOptions {
  /** BCP-47 locale hint forwarded to the transcribe endpoint, e.g. "en-US". */
  locale?: string;
  /** Called once when a final transcript is produced. */
  onResult?: (transcript: string) => void;
  /** Called when the recording or transcription pipeline fails. */
  onError?: (error: SpeechInputError) => void;
  /** Hard cap on a single recording (default 60 s, mirrors the web hook). */
  maxDurationMs?: number;
}

export interface SpeechInputApi {
  status: SpeechInputStatus;
  transcript: string;
  error: SpeechInputError | null;
  /** True when the platform supports microphone capture (false on web). */
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

const MAX_RECORDED_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_DURATION_MS = 60_000;

/**
 * Mobile counterpart to the web `useSpeechInput` hook in
 * `packages/stage-runtime/src/useSpeechInput.ts`. Records via expo-av and
 * uploads the clip to ai-svc's `POST /api/ai/transcribe` (the same endpoint
 * the web MediaRecorder fallback hits).
 *
 * Web platform is intentionally unsupported here — the web build of the
 * homework chat already uses the browser-native hook from `@aivo/stage-runtime`.
 */
export function useSpeechInput({
  locale,
  onResult,
  onError,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
}: UseSpeechInputOptions = {}): SpeechInputApi {
  const [status, setStatus] = useState<SpeechInputStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<SpeechInputError | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);
  const cancelledRef = useRef(false);

  // expo-av's Recording APIs require a native module. On Expo web we fall back
  // to "unsupported" so the caller can hide the button.
  const isSupported = Platform.OS !== "web";

  const cleanup = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    isStoppingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      cleanup();
      // Best-effort teardown if the component unmounts mid-recording.
      const rec = recordingRef.current;
      recordingRef.current = null;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [cleanup]);

  const fail = useCallback(
    (err: SpeechInputError) => {
      cleanup();
      setStatus("error");
      setError(err);
      onError?.(err);
    },
    [cleanup, onError],
  );

  const reset = useCallback(() => {
    cleanup();
    setTranscript("");
    setError(null);
    setStatus("idle");
  }, [cleanup]);

  const stop = useCallback(async () => {
    if (isStoppingRef.current) return;
    const rec = recordingRef.current;
    if (!rec) return;
    isStoppingRef.current = true;
    setStatus("processing");

    let uri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      uri = rec.getURI();
    } catch {
      recordingRef.current = null;
      fail("audio_capture");
      return;
    }
    recordingRef.current = null;
    // Restore the default audio mode so subsequent playback works.
    Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);

    if (cancelledRef.current) {
      cleanup();
      return;
    }
    if (!uri) {
      fail("audio_capture");
      return;
    }

    try {
      // `FileInfo.size` is always populated for an existing file in the
      // legacy API; the old `{ size: true }` option was removed in SDK 54.
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        fail("audio_capture");
        return;
      }
      if (typeof info.size === "number" && info.size > MAX_RECORDED_BYTES) {
        fail("audio_capture");
        return;
      }
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // expo-av's HIGH_QUALITY preset records to .m4a / AAC on both iOS and
      // Android, so we hard-code the matching mime type for the upload.
      const mimeType = "audio/m4a";

      const res = await apiFetch(API.AI, "/api/ai/transcribe", {
        method: "POST",
        body: JSON.stringify({
          audio_base64: audioBase64,
          mime_type: mimeType,
          locale: locale ?? null,
        }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          fail("permission_denied");
        } else {
          fail("transcription_failed");
        }
        return;
      }
      const json = (await res.json()) as { transcript?: string };
      const text = (json.transcript ?? "").trim();
      if (!text) {
        fail("no_speech");
        return;
      }
      setTranscript(text);
      setStatus("idle");
      setError(null);
      onResult?.(text);
    } catch {
      fail("network");
    } finally {
      // Best-effort cleanup of the temp file.
      if (uri) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      }
      cleanup();
    }
  }, [cleanup, fail, locale, onResult]);

  const start = useCallback(async () => {
    if (!isSupported) {
      fail("unsupported");
      return;
    }
    if (recordingRef.current) return;
    setError(null);
    setTranscript("");

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        fail("permission_denied");
        return;
      }
    } catch {
      fail("permission_denied");
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      cancelledRef.current = false;
      setStatus("listening");
      // Auto-stop guard — mirrors the 60 s cap on the web hook.
      stopTimerRef.current = setTimeout(() => {
        stop().catch(() => undefined);
      }, maxDurationMs);
    } catch {
      recordingRef.current = null;
      fail("audio_capture");
    }
  }, [fail, isSupported, maxDurationMs, stop]);

  return { status, transcript, error, isSupported, start, stop, reset };
}
