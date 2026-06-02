"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { LearnerVoicePreference, TTSVoiceId } from "@/lib/db/types";
import { Button } from "@/components/ui/button";

const VOICES: { id: TTSVoiceId; labelKey: string }[] = [
  { id: "kid_friendly", labelKey: "voice_kid_friendly" },
  { id: "warm_female", labelKey: "voice_warm_female" },
  { id: "warm_male", labelKey: "voice_warm_male" },
  { id: "calm_neutral", labelKey: "voice_calm_neutral" },
  { id: "narrator_low", labelKey: "voice_narrator_low" },
  { id: "narrator_high", labelKey: "voice_narrator_high" },
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
  const t = useTranslations("learner.settings_audio");
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
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? t("failed"));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("failed"));
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
          text: t("preview_text"),
          voiceId,
          speed,
          contextKind: "ui_label",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        // Failed TTS does not block — gracefully fall back to transcript.
        setTranscript(t("preview_text"));
        throw new Error(json?.error?.message ?? t("preview_failed"));
      }
      setPreviewSrc(json.data.asset.storageKey);
      setTranscript(json.data.asset.text);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : t("preview_failed"));
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {canToggleEnabled && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t("enable_label")}
        </label>
      )}
      <label className="block text-sm">
        {t("voice_label")}
        <select
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value as TTSVoiceId)}
          className="mt-1 w-full rounded border px-2 py-1"
        >
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {t(v.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        {t("speed_label", { speed: speed.toFixed(2) })}
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
        {t("captions_label")}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={preview} disabled={previewBusy}>
          {previewBusy ? t("generating") : t("preview")}
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          {t("save")}
        </Button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
      {previewSrc && (
        <audio controls src={previewSrc} className="w-full" aria-label={t("preview_aria")}>
          {t("no_audio_support")}
        </audio>
      )}
      {transcript && (
        <p className="rounded bg-aivo-surface-2 px-3 py-2 text-sm">
          <span className="text-xs uppercase text-aivo-muted mr-2">{t("transcript")}</span>
          {transcript}
        </p>
      )}
      {previewError && !previewSrc && (
        <p className="text-xs text-aivo-muted">{t("preview_unavailable")}</p>
      )}
    </div>
  );
}
