import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LearnerSurfaceSpec,
  SurfaceResponse,
  VoiceResponsePayload,
} from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface VoiceResponseSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

type RecorderState =
  | "idle"
  | "recording"
  | "uploading"
  | "recorded"
  | "denied"
  | "unsupported";

const DEFAULT_MAX_DURATION_MS = 60_000;
const MAX_RECORDED_BYTES = 5 * 1024 * 1024;
const DEFAULT_SCORE_URL = "/api/speech-eval/evaluate";
/** Number of frequency buckets visualised in the level meter bar. */
const METER_BARS = 20;

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

interface ScoreResult {
  transcript: string;
  scores: {
    pronunciation: number;
    fluency: number;
    perWord?: Array<{ word: string; score: number }>;
  };
  degraded: boolean;
}

async function uploadAndScore(
  blob: Blob,
  mimeType: string,
  targetText: string,
  language: string,
  scoreServiceUrl: string,
): Promise<ScoreResult> {
  const form = new FormData();
  form.append("audio", blob, `recording.${mimeType.split("/")[1]?.split(";")[0] ?? "webm"}`);
  form.append("targetText", targetText);
  form.append("language", language);
  const res = await fetch(scoreServiceUrl, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`speech-eval-svc returned ${res.status}`);
  }
  return res.json() as Promise<ScoreResult>;
}

/**
 * Sprint 4.3 — Voice response surface.
 *
 * Captures learner audio via MediaRecorder, uploads to speech-eval-svc,
 * and displays ASR transcript + pronunciation/fluency scores. Honors
 * large-text and reduced-motion accessibility preferences. Emits
 * voice-record-start, voice-record-stop, voice-upload, and
 * voice-score-received telemetry events.
 */
export function VoiceResponseSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: VoiceResponseSurfaceProps) {
  const spec = surface.voiceResponse;
  const language = spec?.language ?? "en-US";
  const targetText = spec?.targetText ?? surface.prompt;
  const maxDurationMs = (spec?.maxDurationSeconds ?? 60) * 1_000;
  const scoreServiceUrl = spec?.scoreServiceUrl ?? DEFAULT_SCORE_URL;
  const reducedMotion = surface.accessibility.reduceMotionSafe;
  const largeText = (surface.accessibility as any).largeText as boolean | undefined;

  const [state, setState] = useState<RecorderState>("idle");
  const [recording, setRecording] = useState<VoiceResponsePayload | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [meterLevel, setMeterLevel] = useState(0); // 0–1 normalised

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const bytesRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setMeterLevel(0);
  }, []);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    stopMeter();
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* already closed */ }
      audioCtxRef.current = null;
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
  }, [stopMeter]);

  useEffect(() => () => cleanup(), [cleanup]);

  const startMeter = useCallback((stream: MediaStream) => {
    if (reducedMotion) return; // skip animation when reduced-motion is on
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        setMeterLevel(avg / 255);
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext not available (SSR / test env)
    }
  }, [reducedMotion]);

  const start = useCallback(async () => {
    if (disabled || state === "recording") return;
    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "";
      setState(
        name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported",
      );
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
        try { recorder.stop(); } catch { /* already stopping */ }
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

      onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { tool: "voice_record_stop", durationMs }));

      setState("uploading");
      setUploadError(null);
      onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { tool: "voice_upload", bytes: blob.size }));

      let scoreResult: ScoreResult | null = null;
      try {
        scoreResult = await uploadAndScore(blob, mimeRef.current, targetText, language, scoreServiceUrl);
        onEvent?.(
          createSurfaceEvent(surface.id, "answer_changed", {
            kind: "voice_score_received",
            pronunciation: scoreResult.scores.pronunciation,
            fluency: scoreResult.scores.fluency,
            degraded: scoreResult.degraded,
          }),
        );
      } catch (err: any) {
        setUploadError(err?.message ?? "Upload failed");
      }

      try {
        const dataUrl = await blobToDataUrl(blob);
        const payload: VoiceResponsePayload = {
          audioDataUrl: dataUrl,
          mimeType: mimeRef.current,
          durationMs,
          transcript: scoreResult?.transcript,
          scores: scoreResult?.scores,
          degraded: scoreResult?.degraded,
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
    setRecording(null);
    recorder.start();
    setState("recording");
    onEvent?.(createSurfaceEvent(surface.id, "tool_changed", { tool: "voice_record_start" }));
    startMeter(stream);
    tickRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
    }, 250);
    timeoutRef.current = setTimeout(() => {
      try { recorder.stop(); } catch { /* already stopped */ }
    }, Math.min(maxDurationMs, DEFAULT_MAX_DURATION_MS));
  }, [cleanup, disabled, language, maxDurationMs, onEvent, scoreServiceUrl, startMeter, state, surface.id, targetText]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      try { recorderRef.current.stop(); } catch { /* already stopped */ }
    }
  }, []);

  const discard = useCallback(() => {
    setRecording(null);
    setState("idle");
    setElapsed(0);
    setUploadError(null);
  }, []);

  const submitDisabled =
    disabled ||
    (surface.capture.finalAnswer && !recording) ||
    state === "recording" ||
    state === "uploading";

  const elapsedSeconds = Math.floor(elapsed / 1000);
  const maxSeconds = Math.round(maxDurationMs / 1_000);
  const textClass = largeText ? "text-lg" : "";

  // Level meter: split 0–1 into METER_BARS buckets
  const activeBars = Math.round(meterLevel * METER_BARS);

  return (
    <section aria-label="voice-response-surface" className={textClass}>
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}

      {state === "denied" ? (
        <p role="alert">
          Microphone access was denied. Allow it in your browser settings to record an answer.
        </p>
      ) : state === "unsupported" ? (
        <p role="alert">Voice recording isn&apos;t supported on this device or browser.</p>
      ) : null}

      {uploadError ? (
        <p role="alert" aria-live="polite">
          Score upload failed: {uploadError}. You can still submit your recording.
        </p>
      ) : null}

      {/* Level meter — hidden when reduced-motion is on */}
      {state === "recording" && !reducedMotion ? (
        <div
          role="img"
          aria-label={`recording level ${Math.round(meterLevel * 100)}%`}
          aria-hidden="true"
          style={{ display: "flex", gap: 2, height: 16, alignItems: "flex-end" }}
        >
          {Array.from({ length: METER_BARS }, (_, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: i < activeBars ? "100%" : "20%",
                background: i < activeBars ? "#22c55e" : "#d1d5db",
                borderRadius: 2,
                transition: "height 0.1s",
              }}
            />
          ))}
        </div>
      ) : null}

      <div role="group" aria-label="voice recorder">
        {state === "recording" ? (
          <>
            <p aria-live="polite" aria-atomic="true">
              Recording… {elapsedSeconds}s / {maxSeconds}s
            </p>
            <button type="button" aria-label="stop recording" onClick={stop} disabled={disabled}>
              ■ Stop
            </button>
          </>
        ) : state === "uploading" ? (
          <p aria-live="polite" aria-atomic="true">Uploading and scoring…</p>
        ) : (
          <button
            type="button"
            aria-label="record voice answer"
            onClick={() => { void start(); }}
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
            {recording.transcript ? (
              <div aria-label="transcript">
                <strong>Transcript:</strong> {recording.transcript}
                {recording.degraded ? (
                  <span title="Mock scores — real ASR not yet wired"> (preview)</span>
                ) : null}
              </div>
            ) : null}
            {recording.scores ? (
              <div aria-label="scores">
                <div>
                  <strong>Pronunciation:</strong> {recording.scores.pronunciation}/100
                </div>
                <div>
                  <strong>Fluency:</strong> {recording.scores.fluency}/100
                </div>
                {recording.scores.perWord && recording.scores.perWord.length > 0 ? (
                  <ul aria-label="per-word pronunciation scores">
                    {recording.scores.perWord.map((pw) => (
                      <li key={pw.word}>
                        {pw.word}: {pw.score}/100
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
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
              hasScores: Boolean(recording?.scores),
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

