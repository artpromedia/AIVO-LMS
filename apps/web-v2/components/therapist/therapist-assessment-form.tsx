"use client";

/**
 * Therapist intake form (adaptive-learning E2E Sprint 6; polished in Sprint
 * C-10). The therapist counterpart of the parent assessment wizard, condensed
 * to one card with sections. Every field except discipline is optional (partial
 * submissions welcome; the baseline prompt degrades gracefully).
 *
 * Sprint C-10 brings the flow to the enterprise bar:
 *   - an autosaving DRAFT keyed by (therapist, learner) — restored on return,
 *     surviving a tab kill, with a visible "Saved · just now" indicator;
 *   - an honest up-front time estimate;
 *   - the learner's active IEP goals + accommodations beside the form
 *     (authorized, role-appropriate read — never raw IEP text);
 *   - errors associated to their fields (aria-describedby / aria-invalid);
 *   - a timestamped post-submit SUMMARY RECORD of exactly what was shared.
 *
 * Clinical fields and the "everything is optional" framing are preserved. The
 * therapist insights still fold as NON-REMOVABLE accommodations downstream —
 * that semantic is untouched here.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const DISCIPLINES = ["speech", "occupational", "behavioral", "physical", "other"] as const;
type Discipline = (typeof DISCIPLINES)[number];

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Reverse of splitList — render a stored array back into the textarea. */
function joinList(value: unknown): string {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string").join(", ") : "";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type Phase = "loading" | "editing" | "submitting" | "done" | "error";
type SaveState = "idle" | "saving" | "saved" | "save_error";

type IepPanel =
  | { onFile: false }
  | {
      onFile: true;
      goals: string[];
      accommodations: string[];
      serviceAreas: string[];
      summary: string | null;
      uploadedAt: string;
    };

type SubmissionRecord = {
  assessmentId: string | null;
  submittedAt: string;
  elapsedSeconds: number;
  therapyDiscipline: Discipline;
  areasOfFocus: string[];
  strengths: string[];
  challenges: string[];
  regulationStrategies: string[];
  recommendedAccommodations: string[];
  sensoryNotes: string | null;
  communicationNotes: string | null;
  observations: string | null;
};

/** The autosave payload built from the current field values. */
function buildPayload(s: {
  discipline: Discipline;
  areasOfFocus: string;
  strengths: string;
  challenges: string;
  regulationStrategies: string;
  recommendedAccommodations: string;
  sensoryNotes: string;
  communicationNotes: string;
  observations: string;
}) {
  return {
    therapyDiscipline: s.discipline,
    areasOfFocus: splitList(s.areasOfFocus),
    strengths: splitList(s.strengths),
    challenges: splitList(s.challenges),
    regulationStrategies: splitList(s.regulationStrategies),
    recommendedAccommodations: splitList(s.recommendedAccommodations),
    ...(s.sensoryNotes.trim() ? { sensoryNotes: s.sensoryNotes.trim() } : {}),
    ...(s.communicationNotes.trim() ? { communicationNotes: s.communicationNotes.trim() } : {}),
    ...(s.observations.trim() ? { observations: s.observations.trim() } : {}),
  };
}

export function TherapistAssessmentForm({ learnerId }: { learnerId: string }) {
  const t = useTranslations("therapist.assessment");

  const [phase, setPhase] = React.useState<Phase>("loading");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [iep, setIep] = React.useState<IepPanel | null>(null);
  const [record, setRecord] = React.useState<SubmissionRecord | null>(null);

  const [discipline, setDiscipline] = React.useState<Discipline>("speech");
  const [areasOfFocus, setAreasOfFocus] = React.useState("");
  const [strengths, setStrengths] = React.useState("");
  const [challenges, setChallenges] = React.useState("");
  const [regulationStrategies, setRegulationStrategies] = React.useState("");
  const [recommendedAccommodations, setRecommendedAccommodations] = React.useState("");
  const [sensoryNotes, setSensoryNotes] = React.useState("");
  const [communicationNotes, setCommunicationNotes] = React.useState("");
  const [observations, setObservations] = React.useState("");

  // The client-owned wall clock that anchors the elapsed time-to-complete
  // telemetry (survives server restarts; the draft's startedAtMs is the server
  // fallback). Set when the form first becomes editable.
  const startedAtRef = React.useRef<number>(Date.now());
  // Debounce timer + a flag so the very first hydration doesn't trigger a save.
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = React.useRef(false);

  // ── Load the draft + IEP panel on mount. Restores any in-progress draft so a
  // therapist who closed the tab resumes exactly where they left off. ──
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bff/learners/${learnerId}/therapist-assessment`, {
          method: "GET",
          headers: { "content-type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setPhase("editing");
          return;
        }
        const json = (await res.json()) as {
          data?: {
            draft?: { answers?: { form?: Record<string, unknown> }; startedAtMs?: number };
            iep?: IepPanel;
          };
        };
        if (cancelled) return;
        const form = json.data?.draft?.answers?.form;
        if (form) {
          const d = asString(form.therapyDiscipline);
          if ((DISCIPLINES as readonly string[]).includes(d)) setDiscipline(d as Discipline);
          setAreasOfFocus(joinList(form.areasOfFocus));
          setStrengths(joinList(form.strengths));
          setChallenges(joinList(form.challenges));
          setRegulationStrategies(joinList(form.regulationStrategies));
          setRecommendedAccommodations(joinList(form.recommendedAccommodations));
          setSensoryNotes(asString(form.sensoryNotes));
          setCommunicationNotes(asString(form.communicationNotes));
          setObservations(asString(form.observations));
          // A restored draft already has content — show it as saved.
          setSaveState("saved");
        }
        if (typeof json.data?.draft?.startedAtMs === "number") {
          startedAtRef.current = json.data.draft.startedAtMs;
        }
        setIep(json.data?.iep ?? { onFile: false });
        setPhase("editing");
      } catch {
        if (!cancelled) setPhase("editing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  // ── Debounced autosave whenever a field changes (once editable + hydrated). ──
  const fieldValues = {
    discipline,
    areasOfFocus,
    strengths,
    challenges,
    regulationStrategies,
    recommendedAccommodations,
    sensoryNotes,
    communicationNotes,
    observations,
  };
  React.useEffect(() => {
    if (phase !== "editing") return;
    // Skip the save that the initial hydration would otherwise trigger.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bff/learners/${learnerId}/therapist-assessment`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildPayload(fieldValues)),
        });
        setSaveState(res.ok ? "saved" : "save_error");
      } catch {
        setSaveState("save_error");
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    discipline,
    areasOfFocus,
    strengths,
    challenges,
    regulationStrategies,
    recommendedAccommodations,
    sensoryNotes,
    communicationNotes,
    observations,
    phase,
    learnerId,
  ]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Flush any pending autosave timer so we don't race it.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setPhase("submitting");
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/therapist-assessment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...buildPayload(fieldValues), startedAtMs: startedAtRef.current }),
      });
      if (!res.ok) {
        setPhase("error");
        return;
      }
      const json = (await res.json()) as { data?: { record?: SubmissionRecord } };
      setRecord(json.data?.record ?? null);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  // ── Post-submit SUMMARY RECORD ──
  if (phase === "done") {
    return <SubmissionSummary record={record} />;
  }

  const saveIndicator = (() => {
    switch (saveState) {
      case "saving":
        return (
          <span className="text-xs text-iw-ink-muted" data-testid="therapist-save-indicator">
            {t("save_saving")}
          </span>
        );
      case "saved":
        return (
          <span
            className="text-xs text-iw-success-strong"
            data-testid="therapist-save-indicator"
            data-state="saved"
          >
            {t("save_saved")}
          </span>
        );
      case "save_error":
        return (
          <span
            className="text-xs text-iw-error"
            role="status"
            data-testid="therapist-save-indicator"
            data-state="error"
          >
            {t("save_error")}
          </span>
        );
      default:
        return <span />;
    }
  })();

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
        className="rounded-md border border-iw-border px-2 py-1.5 text-sm"
        placeholder={t("list_hint")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <form onSubmit={submit} className="flex flex-col gap-4 lg:col-span-2">
        {/* Up-front time estimate + the always-optional framing (preserved). */}
        <p className="rounded-md bg-iw-raised px-3 py-2 text-sm text-iw-ink-muted">
          {t("time_estimate")}
        </p>

        {/* Polite, non-intrusive autosave status for screen readers + sighted users. */}
        <div className="flex items-center justify-end" aria-live="polite">
          {phase === "loading" ? (
            <span className="text-xs text-iw-ink-muted">{t("loading")}</span>
          ) : (
            saveIndicator
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="discipline">
            {t("discipline")}
          </label>
          <select
            id="discipline"
            className="w-fit rounded-md border border-iw-border px-2 py-1.5 text-sm"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as Discipline)}
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
        {listField(
          "regulation",
          t("regulation_strategies"),
          regulationStrategies,
          setRegulationStrategies,
        )}
        {listField(
          "accommodations",
          t("recommended_accommodations"),
          recommendedAccommodations,
          setRecommendedAccommodations,
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="sensory">
            {t("sensory_notes")}
          </label>
          <textarea
            id="sensory"
            rows={2}
            className="rounded-md border border-iw-border px-2 py-1.5 text-sm"
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
            className="rounded-md border border-iw-border px-2 py-1.5 text-sm"
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
            className="rounded-md border border-iw-border px-2 py-1.5 text-sm"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </div>

        {phase === "error" ? (
          <p
            id="therapist-submit-error"
            role="alert"
            className="text-sm text-iw-error"
            aria-describedby="discipline"
          >
            {t("submit_error")}
          </p>
        ) : null}
        <div>
          <Button
            type="submit"
            disabled={phase === "submitting"}
            aria-busy={phase === "submitting"}
            aria-describedby={phase === "error" ? "therapist-submit-error" : undefined}
          >
            {phase === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>

      {/* IEP side-panel — authorized, role-appropriate read. */}
      <aside aria-labelledby="iep-panel-title" className="lg:col-span-1">
        <IepSidePanel iep={iep} loading={phase === "loading"} />
      </aside>
    </div>
  );
}

function IepSidePanel({ iep, loading }: { iep: IepPanel | null; loading: boolean }) {
  const t = useTranslations("therapist.assessment.iep_panel");
  return (
    <div className="rounded-lg border border-iw-border bg-iw-raised p-4">
      <h2 id="iep-panel-title" className="text-sm font-semibold text-iw-ink">
        {t("title")}
      </h2>
      <p className="mt-1 text-xs text-iw-ink-muted">{t("subtitle")}</p>

      {loading || iep === null ? (
        <p className="mt-3 text-sm text-iw-ink-muted">{t("loading")}</p>
      ) : !iep.onFile ? (
        <p className="mt-3 text-sm text-iw-ink-muted" data-testid="iep-panel-empty">
          {t("empty")}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3" data-testid="iep-panel-content">
          {iep.goals.length > 0 ? (
            <section>
              <h3 className="iw-label text-iw-ink-muted">{t("goals")}</h3>
              <ul className="mt-1 list-disc pl-4 text-sm">
                {iep.goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {iep.accommodations.length > 0 ? (
            <section>
              <h3 className="iw-label text-iw-ink-muted">{t("accommodations")}</h3>
              <ul className="mt-1 list-disc pl-4 text-sm">
                {iep.accommodations.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {iep.serviceAreas.length > 0 ? (
            <section>
              <h3 className="iw-label text-iw-ink-muted">{t("service_areas")}</h3>
              <p className="mt-1 text-sm">{iep.serviceAreas.join(", ")}</p>
            </section>
          ) : null}
          {iep.summary ? (
            <section>
              <h3 className="iw-label text-iw-ink-muted">{t("summary")}</h3>
              <p className="mt-1 text-sm text-iw-ink-muted">{iep.summary}</p>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SubmissionSummary({ record }: { record: SubmissionRecord | null }) {
  const t = useTranslations("therapist.assessment");
  const ts = useTranslations("therapist.assessment.summary");

  const lists: Array<{ label: string; items: string[] }> = record
    ? [
        { label: ts("areas_of_focus"), items: record.areasOfFocus },
        { label: ts("strengths"), items: record.strengths },
        { label: ts("challenges"), items: record.challenges },
        { label: ts("regulation_strategies"), items: record.regulationStrategies },
        { label: ts("recommended_accommodations"), items: record.recommendedAccommodations },
      ].filter((l) => l.items.length > 0)
    : [];

  const notes: Array<{ label: string; text: string | null }> = record
    ? [
        { label: ts("sensory_notes"), text: record.sensoryNotes },
        { label: ts("communication_notes"), text: record.communicationNotes },
        { label: ts("observations"), text: record.observations },
      ].filter((n) => n.text)
    : [];

  return (
    <div
      className="rounded-lg border border-iw-success bg-iw-success-subtle p-4"
      role="status"
      data-testid="therapist-submission-record"
    >
      <p className="font-medium">{t("success_title")}</p>
      <p className="mt-1 text-sm text-iw-ink-muted">{t("success_body")}</p>

      {record ? (
        <div className="mt-4 flex flex-col gap-3 rounded-md bg-white p-3">
          <p className="text-xs text-iw-ink-muted">
            {ts("submitted_at", { when: new Date(record.submittedAt).toLocaleString() })}
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="iw-label text-iw-ink-muted">{ts("discipline")}</dt>
              <dd>{t(`discipline_${record.therapyDiscipline}`)}</dd>
            </div>
            {lists.map((l) => (
              <div key={l.label}>
                <dt className="iw-label text-iw-ink-muted">{l.label}</dt>
                <dd>
                  <ul className="list-disc pl-4">
                    {l.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
            {notes.map((n) => (
              <div key={n.label}>
                <dt className="iw-label text-iw-ink-muted">{n.label}</dt>
                <dd className="whitespace-pre-wrap">{n.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
