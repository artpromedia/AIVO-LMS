"use client";

/**
 * Sprint C-10 — an authored observation row with an author-only, 15-minute
 * edit affordance. The "Edit" control shows only while the window is open AND
 * the viewer is the author (the page passes `canEdit`); once the window passes
 * (client clock), it disappears. Saving PATCHes the web BFF, which re-enforces
 * ownership + window server-side and preserves the prior text in history.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";

export type ObservationView = {
  id: string;
  learnerName: string;
  location: string;
  observedAt: string;
  createdAt: string;
  durationMinutes: number | null;
  behaviour: string;
  antecedent: string;
  consequence: string;
  mood: string | null;
  edited: boolean;
};

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const KNOWN_MOODS = ["calm", "happy", "frustrated", "tired", "anxious", "upset"] as const;

/** Translate a known mood key; fall back to the raw value for moods authored
 *  on another surface (e.g. the family-svc table's free-text mood). */
function moodLabel(t: (key: string) => string, mood: string): string {
  return (KNOWN_MOODS as readonly string[]).includes(mood) ? t(`mood_${mood}`) : mood;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ObservationRow({
  obs,
  canEdit,
}: {
  obs: ObservationView;
  canEdit: boolean;
}) {
  const t = useTranslations("caregiver.observations");
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Live window check on the client so the affordance disappears at 15 min
  // without a reload. Recomputed each render; a 30s ticker nudges it closed.
  const [, force] = React.useState(0);
  React.useEffect(() => {
    if (!canEdit) return;
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [canEdit]);
  const withinWindow = Date.now() - new Date(obs.createdAt).getTime() <= EDIT_WINDOW_MS;
  const showEdit = canEdit && withinWindow;

  const [behaviour, setBehaviour] = React.useState(obs.behaviour);
  const [antecedent, setAntecedent] = React.useState(obs.antecedent);
  const [consequence, setConsequence] = React.useState(obs.consequence);

  async function save() {
    setError(null);
    if (!behaviour.trim()) {
      setError(t("error_required"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/bff/caregiver/observations/${obs.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          behaviour: behaviour.trim(),
          antecedent: antecedent.trim(),
          consequence: consequence.trim(),
        }),
      });
      if (!res.ok) {
        setError(t("edit_failed"));
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError(t("edit_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">
          {obs.learnerName} · <span className="text-aivo-ink-soft">{obs.location}</span>
          {obs.edited ? (
            <span className="ml-2 text-xs font-normal text-aivo-ink-soft">{t("edited_label")}</span>
          ) : null}
        </p>
        {showEdit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            data-testid={`observation-edit-${obs.id}`}
            className="text-xs font-medium text-[var(--aivo-sensory-primary)] underline"
          >
            {t("edit_action")}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-aivo-ink-soft">
        {formatWhen(obs.observedAt)}
        {obs.durationMinutes !== null ? ` · ${obs.durationMinutes} min` : ""}
        {obs.mood ? ` · ${t("mood_prefix")} ${moodLabel(t, obs.mood)}` : ""}
      </p>

      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="iw-label text-aivo-ink-soft">{t("label_behaviour")}</span>
            <textarea
              rows={2}
              value={behaviour}
              onChange={(e) => setBehaviour(e.target.value)}
              className="rounded border border-aivo-border px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="iw-label text-aivo-ink-soft">{t("label_antecedent")}</span>
            <textarea
              rows={2}
              value={antecedent}
              onChange={(e) => setAntecedent(e.target.value)}
              className="rounded border border-aivo-border px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="iw-label text-aivo-ink-soft">{t("label_consequence")}</span>
            <textarea
              rows={2}
              value={consequence}
              onChange={(e) => setConsequence(e.target.value)}
              className="rounded border border-aivo-border px-2 py-1.5"
            />
          </label>
          {error ? (
            <p className="text-sm text-aivo-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded bg-[var(--aivo-sensory-primary)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? t("saving") : t("edit_save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setBehaviour(obs.behaviour);
                setAntecedent(obs.antecedent);
                setConsequence(obs.consequence);
                setError(null);
              }}
              className="rounded border border-aivo-border px-3 py-1.5 text-sm"
            >
              {t("edit_cancel")}
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-1 text-sm md:grid-cols-3">
          <div>
            <dt className="iw-label text-aivo-ink-soft">{t("label_antecedent")}</dt>
            <dd>{obs.antecedent || "—"}</dd>
          </div>
          <div>
            <dt className="iw-label text-aivo-ink-soft">{t("label_behaviour")}</dt>
            <dd className="font-medium">{obs.behaviour}</dd>
          </div>
          <div>
            <dt className="iw-label text-aivo-ink-soft">{t("label_consequence")}</dt>
            <dd>{obs.consequence || "—"}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}
