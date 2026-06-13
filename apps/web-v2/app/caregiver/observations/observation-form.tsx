"use client";

/**
 * Caregiver observation authoring form (Sprint 10; polished in Sprint C-10).
 *
 * Posts to /api/bff/caregiver/observations. Sprint C-10 brings it to the
 * enterprise bar for an untrained, possibly-ESL caregiver:
 *   - 3 worked ABC examples (collapsible, plain language) anchor the fields;
 *   - an optional, gentle MOOD picker (the schema already carries `mood`);
 *   - an ANNOUNCED success (aria-live) — "Saved — thank you. This helps AIVO
 *     see patterns." — instead of a silent page refresh;
 *   - a localStorage DRAFT that survives a network failure and is cleared on
 *     success, so a caregiver never loses what they typed.
 * The 2-required-field minimum (learner + behaviour) is kept.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";

type LearnerOption = { id: string; name: string };

const MOODS = ["calm", "happy", "frustrated", "tired", "anxious", "upset"] as const;
type Mood = (typeof MOODS)[number];

const DRAFT_KEY_PREFIX = "aivo.caregiver.observation.draft";

type DraftShape = {
  learnerId: string;
  location: string;
  behaviour: string;
  antecedent: string;
  consequence: string;
  durationMinutes: string;
  mood: string;
};

export function CaregiverObservationForm({ learners }: { learners: LearnerOption[] }) {
  const t = useTranslations("caregiver.observations");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [showExamples, setShowExamples] = React.useState(false);
  const [mood, setMood] = React.useState<Mood | "">("");

  // Controlled fields so we can persist + restore a draft across a network
  // failure. Keyed per-browser (not per-learner) since the form is one row.
  const [learnerId, setLearnerId] = React.useState("");
  const [location, setLocation] = React.useState("home");
  const [behaviour, setBehaviour] = React.useState("");
  const [antecedent, setAntecedent] = React.useState("");
  const [consequence, setConsequence] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState("");

  const draftKey = DRAFT_KEY_PREFIX;

  // Restore a draft left behind by a prior failed submit.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<DraftShape>;
      if (d.learnerId) setLearnerId(d.learnerId);
      if (d.location) setLocation(d.location);
      if (d.behaviour) setBehaviour(d.behaviour);
      if (d.antecedent) setAntecedent(d.antecedent);
      if (d.consequence) setConsequence(d.consequence);
      if (d.durationMinutes) setDurationMinutes(d.durationMinutes);
      if (d.mood && (MOODS as readonly string[]).includes(d.mood)) setMood(d.mood as Mood);
    } catch {
      /* corrupt draft — ignore and start fresh */
    }
  }, [draftKey]);

  function persistDraft() {
    try {
      const draft: DraftShape = {
        learnerId,
        location,
        behaviour,
        antecedent,
        consequence,
        durationMinutes,
        mood,
      };
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }

  function resetFields() {
    setLearnerId("");
    setLocation("home");
    setBehaviour("");
    setAntecedent("");
    setConsequence("");
    setDurationMinutes("");
    setMood("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!learnerId || !behaviour.trim()) {
      setError(t("error_required"));
      return;
    }
    setPending(true);
    // Persist BEFORE the network call so an offline/failed submit leaves a
    // recoverable draft.
    persistDraft();
    try {
      const res = await fetch("/api/bff/caregiver/observations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learnerId,
          behaviour: behaviour.trim(),
          antecedent: antecedent.trim(),
          consequence: consequence.trim(),
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
          location,
          mood: mood || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setError(t("error_save", { detail: text.slice(0, 160) }));
        return; // draft stays in localStorage for recovery
      }
      // Success: clear the recovery draft, reset the form, announce politely.
      clearDraft();
      resetFields();
      setSuccess(t("success_announce"));
      router.refresh();
    } catch {
      // Network failure — the draft is already persisted; tell the caregiver
      // their note is safe and they can try again.
      setError(t("error_network"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-4">
      {/* Worked ABC examples — collapsible, plain language, before the fields. */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowExamples((v) => !v)}
          aria-expanded={showExamples}
          aria-controls="abc-examples"
          className="flex w-full items-center justify-between rounded-md bg-aivo-surface-soft px-3 py-2 text-left text-sm font-medium text-aivo-ink"
        >
          <span>{t("examples_toggle")}</span>
          <span aria-hidden="true">{showExamples ? "−" : "+"}</span>
        </button>
        {showExamples ? (
          <div
            id="abc-examples"
            className="mt-2 flex flex-col gap-2 rounded-md border border-aivo-line p-3 text-sm"
          >
            <p className="text-aivo-ink-soft">{t("examples_intro")}</p>
            <ul className="flex flex-col gap-2">
              <li className="rounded bg-aivo-surface-soft p-2">{t("example_1")}</li>
              <li className="rounded bg-aivo-surface-soft p-2">{t("example_2")}</li>
              <li className="rounded bg-aivo-surface-soft p-2">{t("example_3")}</li>
            </ul>
          </div>
        ) : null}
      </div>

      <form
        id="caregiver-observation-form"
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">{t("field_learner")}</span>
          <select
            name="learnerId"
            aria-required="true"
            value={learnerId}
            onChange={(e) => setLearnerId(e.target.value)}
            className="rounded border border-aivo-border px-2 py-1.5"
          >
            <option value="">{t("choose_learner")}</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">{t("field_location")}</span>
          <select
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded border border-aivo-border px-2 py-1.5"
          >
            <option value="home">{t("loc_home")}</option>
            <option value="school">{t("loc_school")}</option>
            <option value="community">{t("loc_community")}</option>
            <option value="therapy">{t("loc_therapy")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span className="iw-label text-aivo-ink-soft">{t("field_behaviour")}</span>
          <textarea
            name="behaviour"
            aria-required="true"
            rows={2}
            value={behaviour}
            onChange={(e) => setBehaviour(e.target.value)}
            placeholder={t("behaviour_placeholder")}
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">{t("field_antecedent")}</span>
          <textarea
            name="antecedent"
            rows={2}
            value={antecedent}
            onChange={(e) => setAntecedent(e.target.value)}
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">{t("field_consequence")}</span>
          <textarea
            name="consequence"
            rows={2}
            value={consequence}
            onChange={(e) => setConsequence(e.target.value)}
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="iw-label text-aivo-ink-soft">{t("field_duration")}</span>
          <input
            type="number"
            name="durationMinutes"
            min={0}
            max={600}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="rounded border border-aivo-border px-2 py-1.5"
          />
        </label>

        {/* Gentle, optional mood picker. */}
        <fieldset className="flex flex-col gap-1 text-sm md:col-span-2">
          <legend className="iw-label text-aivo-ink-soft">{t("field_mood")}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("field_mood")}>
            <button
              type="button"
              role="radio"
              aria-checked={mood === ""}
              onClick={() => setMood("")}
              className={`rounded-full border px-3 py-1 text-sm ${
                mood === ""
                  ? "border-[var(--aivo-sensory-primary)] bg-[var(--aivo-sensory-primary)] text-white"
                  : "border-aivo-border text-aivo-ink"
              }`}
            >
              {t("mood_unset")}
            </button>
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mood === m}
                onClick={() => setMood(m)}
                data-testid={`mood-${m}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  mood === m
                    ? "border-[var(--aivo-sensory-primary)] bg-[var(--aivo-sensory-primary)] text-white"
                    : "border-aivo-border text-aivo-ink"
                }`}
              >
                {t(`mood_${m}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <div className="min-h-[1.25rem] flex-1">
            {error ? (
              <p className="text-sm text-aivo-danger" role="alert" data-testid="observation-form-error">
                {error}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-[var(--aivo-sensory-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            data-testid="observation-form-submit"
          >
            {pending ? t("saving") : t("save_observation")}
          </button>
        </div>
      </form>

      {/* Announced success — replaces the old silent router.refresh(). */}
      <p
        className="mt-3 min-h-[1.25rem] text-sm text-emerald-700"
        role="status"
        aria-live="polite"
        data-testid="observation-form-success"
      >
        {success ?? ""}
      </p>
    </Card>
  );
}
