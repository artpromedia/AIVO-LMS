import { useCallback, useEffect, useRef, useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse, VoiceResponsePayload } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface VoiceResponseSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

type RecorderState = "idle" | "recording" | "recorded" | "denied" | "unsupported";

const MAX_DURATION_MS = 60_000;
const MAX_RECORDED_BYTES = 5 * 1024 * 1024;

function pickMime(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // older browsers don't expose isTypeSupported
    }
  }
  return undefined;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("blob_read_failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Sprint 10 — Voice response surface.
 *
 * Captures a single take of learner audio via MediaRecorder and ships
 * it back as a base64 data URL on `response.voiceResponse`. Deliberately
 * does NOT call any transcription endpoint itself — the scoring
 * service decides whether to STT, score the waveform, or both. This
 * surface is mounted under the `lingua` (Languages) tutor entitlement.
 */
export function VoiceResponseSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: VoiceResponseSurfaceProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [recording, setRecording] = useState<VoiceResponsePayload | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const bytesRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // recorder already torn down
      }
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (disabled || state === "recording") return;
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      return;
    }
    streamRef.current = stream;
    const mime = pickMime() ?? "audio/webm";
    mimeRef.current = mime;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      cleanup();
      setState("unsupported");
      return;
    }
    chunksRef.current = [];
    bytesRef.current = 0;
    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) return;
      if (bytesRef.current + event.data.size > MAX_RECORDED_BYTES) {
        // Hard cap to keep the upload reasonable; stop early.
        try {
          recorder.stop();
        } catch {
          // already stopping
        }
        return;
      }
      bytesRef.current += event.data.size;
      chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      const durationMs = Date.now() - startedAtRef.current;
      cleanup();
      if (blob.size === 0) {
        setState("idle");
        return;
      }
      try {
        const dataUrl = await blobToDataUrl(blob);
        const payload: VoiceResponsePayload = {
          audioDataUrl: dataUrl,
          mimeType: mimeRef.current,
          durationMs,
        };
        setRecording(payload);
        setState("recorded");
        onEvent?.(
          createSurfaceEvent(surface.id, "answer_changed", {
            kind: "voice_response",
            durationMs,
            bytes: blob.size,
          }),
        );
      } catch {
        setState("idle");
      }
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsed(0);
    recorder.start();
    setState("recording");
    onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { tool: "voice_record_start" }));
    tickRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
    }, 250);
    timeoutRef.current = setTimeout(() => {
      try {
        recorder.stop();
      } catch {
        // already stopped
      }
    }, MAX_DURATION_MS);
  }, [cleanup, disabled, onEvent, state, surface.id]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      try {
        recorderRef.current.stop();
      } catch {
        // already stopped
      }
    }
  }, []);

  const discard = useCallback(() => {
    setRecording(null);
    setState("idle");
    setElapsed(0);
  }, []);

  const submitDisabled =
    disabled ||
    (surface.capture.finalAnswer && !recording) ||
    state === "recording";

  const elapsedSeconds = Math.floor(elapsed / 1000);

  return (
    <section aria-label="voice-response-surface">
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}

      {state === "denied" ? (
        <p role="alert">Microphone access was denied. Allow it in your browser settings to record an answer.</p>
      ) : state === "unsupported" ? (
        <p role="alert">Voice recording isn&apos;t supported on this device or browser.</p>
      ) : null}

      <div role="group" aria-label="voice recorder">
        {state === "recording" ? (
          <button type="button" aria-label="stop recording" onClick={stop} disabled={disabled}>
            ■ Stop ({elapsedSeconds}s)
          </button>
        ) : (
          <button
            type="button"
            aria-label="record voice answer"
            onClick={() => {
              void start();
            }}
            disabled={disabled || state === "denied" || state === "unsupported"}
          >
            {recording ? "● Re-record" : "● Record"}
          </button>
        )}

        {recording ? (
          <>
            <audio
              src={recording.audioDataUrl}
              controls
              aria-label="recorded voice answer playback"
            />
            <button
              type="button"
              aria-label="discard recording"
              onClick={discard}
              disabled={disabled}
            >
              Discard
            </button>
          </>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="submit voice answer"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(
            createSurfaceEvent(surface.id, "surface_submitted", {
              kind: "voice_response",
              durationMs: recording?.durationMs ?? 0,
            }),
          );
          onSubmit?.({
            surfaceId: surface.id,
            voiceResponse: recording ?? undefined,
            durationMs: recording?.durationMs,
          });
        }}
      >
        Submit voice answer
      </button>
    </section>
  );
}
