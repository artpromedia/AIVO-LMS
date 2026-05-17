"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LearnerVoicePreference, TTSVoiceId } from "@/lib/db/types";

const VOICES: { id: TTSVoiceId; label: string }[] = [
  { id: "kid_friendly", label: "Kid-friendly" },
  { id: "warm_female", label: "Warm female" },
  { id: "warm_male", label: "Warm male" },
  { id: "calm_neutral", label: "Calm neutral" },
  { id: "narrator_low", label: "Narrator (low)" },
  { id: "narrator_high", label: "Narrator (high)" },
];

export function AudioPrefForm({
  learnerId,
  initial,
  canToggleEnabled,
}: {
  learnerId: string;
  initial: LearnerVoicePreference;
  canToggleEnabled: boolean;
}) {
  const router = useRouter();
  const [voiceId, setVoiceId] = useState<TTSVoiceId>(initial.voiceId);
  const [speed, setSpeed] = useState(initial.speed);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [captionsAlways, setCaptionsAlways] = useState(initial.captionsAlways);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { voiceId, speed, captionsAlways };
      if (canToggleEnabled) body.enabled = enabled;
      const res = await fetch(`/api/bff/learners/${learnerId}/audio-preferences`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Failed.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    setPreviewBusy(true);
    setPreviewError(null);
    setPreviewSrc(null);
    setTranscript(null);
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/tts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: "Hello! This is your read-aloud voice preview.",
          voiceId,
          speed,
          contextKind: "ui_label",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        // Failed TTS does not block — gracefully fall back to transcript.
        setTranscript("Hello! This is your read-aloud voice preview.");
        throw new Error(json?.error?.message ?? "Preview failed.");
      }
      setPreviewSrc(json.data.asset.storageKey);
      setTranscript(json.data.asset.text);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {canToggleEnabled && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enable read-aloud for this learner
        </label>
      )}
      <label className="block text-sm">
        Voice
        <select
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value as TTSVoiceId)}
          className="mt-1 w-full rounded border px-2 py-1"
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Speed: {speed.toFixed(2)}x
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={captionsAlways}
          onChange={(e) => setCaptionsAlways(e.target.checked)}
        />
        Always show captions
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={preview}
          disabled={previewBusy}
          className="rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {previewBusy ? "Generating…" : "Preview voice"}
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="rounded bg-aivo-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
      {previewSrc && (
        <audio controls src={previewSrc} className="w-full" aria-label="Voice preview">
          Your browser does not support audio playback.
        </audio>
      )}
      {transcript && (
        <p className="rounded bg-aivo-surface-2 px-3 py-2 text-sm">
          <span className="text-xs uppercase text-aivo-muted mr-2">Transcript</span>
          {transcript}
        </p>
      )}
      {previewError && !previewSrc && (
        <p className="text-xs text-aivo-muted">
          Audio preview unavailable — transcript fallback shown above.
        </p>
      )}
    </div>
  );
}
