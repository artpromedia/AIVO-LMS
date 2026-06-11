"use client";

/**
 * Therapist intake form (adaptive-learning E2E Sprint 6) — the therapist
 * counterpart of the parent assessment wizard, condensed to one card with
 * sections. Every field except discipline is optional (partial submissions
 * welcome; the baseline prompt degrades gracefully). Submits to
 * /api/bff/learners/:id/therapist-assessment and renders success inline.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const DISCIPLINES = ["speech", "occupational", "behavioral", "physical", "other"] as const;

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

type Phase = "editing" | "submitting" | "done" | "error";

export function TherapistAssessmentForm({ learnerId }: { learnerId: string }) {
  const t = useTranslations("therapist.assessment");
  const [phase, setPhase] = React.useState<Phase>("editing");
  const [discipline, setDiscipline] = React.useState<(typeof DISCIPLINES)[number]>("speech");
  const [areasOfFocus, setAreasOfFocus] = React.useState("");
  const [strengths, setStrengths] = React.useState("");
  const [challenges, setChallenges] = React.useState("");
  const [regulationStrategies, setRegulationStrategies] = React.useState("");
  const [recommendedAccommodations, setRecommendedAccommodations] = React.useState("");
  const [sensoryNotes, setSensoryNotes] = React.useState("");
  const [communicationNotes, setCommunicationNotes] = React.useState("");
  const [observations, setObservations] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("submitting");
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/therapist-assessment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          therapyDiscipline: discipline,
          areasOfFocus: splitList(areasOfFocus),
          strengths: splitList(strengths),
          challenges: splitList(challenges),
          regulationStrategies: splitList(regulationStrategies),
          recommendedAccommodations: splitList(recommendedAccommodations),
          ...(sensoryNotes.trim() ? { sensoryNotes: sensoryNotes.trim() } : {}),
          ...(communicationNotes.trim() ? { communicationNotes: communicationNotes.trim() } : {}),
          ...(observations.trim() ? { observations: observations.trim() } : {}),
        }),
      });
      setPhase(res.ok ? "done" : "error");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status">
        <p className="font-medium">{t("success_title")}</p>
        <p className="mt-1 text-sm text-aivo-ink-soft">{t("success_body")}</p>
      </div>
    );
  }

  const listField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        className="rounded-md border border-aivo-line px-2 py-1.5 text-sm"
        placeholder={t("list_hint")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="discipline">
          {t("discipline")}
        </label>
        <select
          id="discipline"
          className="w-fit rounded-md border border-aivo-line px-2 py-1.5 text-sm"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value as (typeof DISCIPLINES)[number])}
        >
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>
              {t(`discipline_${d}`)}
            </option>
          ))}
        </select>
      </div>

      {listField("areas", t("areas_of_focus"), areasOfFocus, setAreasOfFocus)}
      {listField("strengths", t("strengths"), strengths, setStrengths)}
      {listField("challenges", t("challenges"), challenges, setChallenges)}
      {listField("regulation", t("regulation_strategies"), regulationStrategies, setRegulationStrategies)}
      {listField("accommodations", t("recommended_accommodations"), recommendedAccommodations, setRecommendedAccommodations)}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="sensory">
          {t("sensory_notes")}
        </label>
        <textarea
          id="sensory"
          rows={2}
          className="rounded-md border border-aivo-line px-2 py-1.5 text-sm"
          value={sensoryNotes}
          onChange={(e) => setSensoryNotes(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="communication">
          {t("communication_notes")}
        </label>
        <textarea
          id="communication"
          rows={2}
          className="rounded-md border border-aivo-line px-2 py-1.5 text-sm"
          value={communicationNotes}
          onChange={(e) => setCommunicationNotes(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="observations">
          {t("observations")}
        </label>
        <textarea
          id="observations"
          rows={4}
          className="rounded-md border border-aivo-line px-2 py-1.5 text-sm"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
        />
      </div>

      {phase === "error" ? (
        <p role="alert" className="text-sm text-aivo-danger">
          {t("submit_error")}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={phase === "submitting"} aria-busy={phase === "submitting"}>
          {phase === "submitting" ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
