"use client";

/**
 * Whole-term / trimester syllabus manager (Sprint 6, G7). Used by both the
 * parent and teacher learner views. Lets a parent/teacher paste a full-term
 * syllabus per subject, review the parsed week-by-week scope, and save it so
 * AIVO's pacing explodes it into dated, break-aware weekly foci.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ParsedUnit = {
  title: string;
  duration_weeks: number;
  topics: string[];
  learning_objectives: string[];
  standards_addressed: string[];
  key_vocabulary: string[];
};

type ParseResult = {
  subject: string | null;
  source: string;
  total_terms: number;
  unit_count: number;
  terms: Array<{ term_number: number; title?: string | null; units: ParsedUnit[] }>;
};

type ParseSummary = {
  unitCount: number;
  totalWeeks: number;
  termCount: number;
  standardsCount: number;
};

type SavedUnit = { title: string; validationStatus?: string };

type SavedSyllabus = {
  id: string;
  subject: string;
  title: string | null;
  termCount: number;
  units: SavedUnit[];
  createdAt: string;
};

type JurisdictionLocator = {
  country?: string;
  region?: string;
  postalCode?: string;
  districtId?: string;
  zipCode?: string;
};

function offCurriculumCount(units: SavedUnit[]): number {
  return units.filter((u) => u.validationStatus === "off_curriculum").length;
}

const SUBJECTS = [
  { slug: "math", name: "Math" },
  { slug: "ela", name: "English / Reading" },
  { slug: "science", name: "Science" },
  { slug: "social_studies", name: "Social Studies" },
  { slug: "other", name: "Other" },
];

function fmtDate(d: string): string {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString();
}

type GeneratedPlanSummary = {
  weekCount: number;
  instructionWeeks: number;
  planStart: string;
  weeks: Array<{
    week_index?: number;
    weekIndex?: number;
    week_start?: string;
    weekStart?: string;
    kind: string;
    unit_title?: string | null;
    unitTitle?: string | null;
  }>;
};

export function TermSyllabusManager({
  learnerId,
  apiBase,
  pacingApiBase,
  gradeBand,
  jurisdiction,
}: Readonly<{
  learnerId: string;
  /** e.g. `/api/bff/parent/learners/${learnerId}/term-syllabus` */
  apiBase: string;
  /**
   * Wave B — sibling pacing endpoint, e.g.
   * `/api/bff/parent/learners/${learnerId}/pacing-plan`. When provided, each
   * saved syllabus offers "Generate pacing plan", which lays the saved units
   * onto the learner's stored school calendar (break-aware) in brain-svc.
   */
  pacingApiBase?: string;
  /** Learner grade band — enables syllabus ↔ jurisdiction validation on save. */
  gradeBand?: string;
  /** Learner jurisdiction (US zip/district or country+region) for validation. */
  jurisdiction?: JurisdictionLocator;
}>) {
  const tPlan = useTranslations("curriculum.term_syllabus");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("math");
  const [termCount, setTermCount] = useState(1);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [saved, setSaved] = useState<SavedSyllabus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // Wave B — per-syllabus pacing-plan generation state.
  const [planStart, setPlanStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [planBusyFor, setPlanBusyFor] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<GeneratedPlanSummary | null>(null);

  async function onGeneratePlan(s: SavedSyllabus) {
    if (!pacingApiBase) return;
    setPlanBusyFor(s.id);
    setPlanError(null);
    setPlanResult(null);
    try {
      const res = await fetch(pacingApiBase, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: s.subject, planStart }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlanError(data?.error?.message ?? tPlan("generate_error"));
        return;
      }
      const plan = data?.data?.plan ?? {};
      setPlanResult({
        weekCount: plan.weekCount ?? (plan.weeks?.length || 0),
        instructionWeeks: plan.instructionWeeks ?? 0,
        planStart: plan.planStart ?? planStart,
        weeks: Array.isArray(plan.weeks) ? plan.weeks : [],
      });
    } catch {
      setPlanError(tPlan("generate_error"));
    } finally {
      setPlanBusyFor(null);
    }
  }

  async function refresh() {
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSaved(data?.data?.syllabi ?? []);
      }
    } catch {
      /* non-fatal: list refresh is best-effort */
    }
  }

  useEffect(() => {
    void refresh();
  }, [apiBase]);

  async function onParse() {
    setBusy(true);
    setError(null);
    setParsed(null);
    setSummary(null);
    try {
      const res = await fetch(`${apiBase}/parse-preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, subject, termCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not parse the syllabus.");
        return;
      }
      setParsed(data.data.parsed as ParseResult);
      setSummary(data.data.summary as ParseSummary);
    } catch {
      setError("Could not reach the parser. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, text, parsed, gradeBand, jurisdiction }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save the term syllabus.");
        return;
      }
      setParsed(null);
      setSummary(null);
      setText("");
      // Sprint 11: save now auto-paces — tell the parent exactly what
      // happened instead of leaving a saved-but-unpaced syllabus silent.
      const pacing = data?.data?.pacing as
        | { status: "generated"; weeks?: number }
        | { status: "unavailable" | "failed"; reason?: string }
        | undefined;
      if (pacing?.status === "generated") {
        setSaveNotice(
          pacing.weeks
            ? `Saved — pacing plan generated (${pacing.weeks} weeks).`
            : "Saved — pacing plan generated.",
        );
      } else if (pacing) {
        setSaveNotice(
          `Saved. Pacing not generated: ${pacing.reason ?? "pacing unavailable"} ` +
            'You can retry with "Generate pacing plan" below.',
        );
      } else {
        setSaveNotice("Saved.");
      }
      await refresh();
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await fetch(`${apiBase}/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const allUnits = parsed ? parsed.terms.flatMap((t) => t.units) : [];

  return (
    <div className="space-y-6" data-learner-id={learnerId}>
      <Card className="p-4 space-y-3">
        <h3 className="text-lg font-semibold">Upload a full-term syllabus</h3>
        <p className="text-sm text-muted-foreground">
          Paste the whole term/trimester syllabus for one subject. We&apos;ll turn it into a
          week-by-week plan the tutor follows — break-aware, no page limit.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Subject{" "}
            <select
              className="border rounded px-2 py-1"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {SUBJECTS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Terms{" "}
            <input
              type="number"
              min={1}
              max={4}
              className="border rounded px-2 py-1 w-16"
              value={termCount}
              onChange={(e) => setTermCount(Math.min(4, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
        </div>
        <textarea
          className="w-full border rounded p-2 h-48 font-mono text-sm"
          placeholder="Week 1: ...&#10;Week 2: ..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <Button onClick={onParse} disabled={busy || !text.trim()}>
            {busy ? "Parsing…" : "Parse term"}
          </Button>
          {parsed && (
            <Button variant="outline" onClick={onSave} disabled={busy}>
              Save {summary?.unitCount ?? allUnits.length} weeks
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-iw-error-strong">{error}</p>}
        {saveNotice && (
          <p role="status" className="text-sm text-iw-success-strong" data-testid="syllabus-save-notice">
            {saveNotice}
          </p>
        )}
      </Card>

      {parsed && summary && (
        <Card className="p-4 space-y-3">
          <h4 className="font-semibold">
            Review — {summary.unitCount} units · {summary.totalWeeks} weeks ·{" "}
            {summary.standardsCount} standards
          </h4>
          <ol className="space-y-2 list-decimal pl-5">
            {allUnits.map((u) => (
              <li
                key={`${u.title}-${u.duration_weeks}-${u.standards_addressed.join("|")}`}
                className="text-sm"
              >
                <span className="font-medium">{u.title}</span>
                {u.standards_addressed.length > 0 && (
                  <span className="text-muted-foreground"> · {u.standards_addressed.join(", ")}</span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {saved.length > 0 && (
        <Card className="p-4 space-y-2">
          <h4 className="font-semibold">Saved term syllabi</h4>
          {pacingApiBase && (
            <label className="block text-sm">
              {tPlan("plan_start")}{" "}
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={planStart}
                onChange={(e) => setPlanStart(e.target.value)}
              />
            </label>
          )}
          <ul className="space-y-2">
            {saved.map((s) => {
              const off = offCurriculumCount(s.units);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    {s.title ?? s.subject} · {s.units.length} weeks · {fmtDate(s.createdAt)}
                    {off > 0 && (
                      <span className="rounded bg-iw-warning-subtle text-iw-warning-strong px-2 py-0.5 text-xs">
                        {off} off-curriculum — review
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    {pacingApiBase && (
                      <Button
                        variant="outline"
                        onClick={() => onGeneratePlan(s)}
                        disabled={busy || planBusyFor !== null || !planStart}
                        data-testid={`generate-plan-${s.id}`}
                      >
                        {planBusyFor === s.id ? tPlan("generating") : tPlan("generate_plan")}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => onDelete(s.id)} disabled={busy}>
                      Remove
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
          {planError && (
            <p className="text-sm text-iw-error-strong" role="alert">
              {planError}
            </p>
          )}
          {planResult && (
            <div className="space-y-1 rounded border border-iw-border p-3" data-testid="plan-result">
              <p className="text-sm font-medium">
                {tPlan("plan_ready", {
                  weeks: planResult.weekCount,
                  instruction: planResult.instructionWeeks,
                })}
              </p>
              <ol className="max-h-48 space-y-0.5 overflow-y-auto pl-5 text-xs list-decimal">
                {planResult.weeks.map((w, i) => {
                  const start = w.week_start ?? w.weekStart ?? "";
                  const unit = w.unit_title ?? w.unitTitle ?? "";
                  const label =
                    w.kind === "instruction"
                      ? unit
                      : w.kind === "break"
                        ? tPlan("week_kind_break")
                        : tPlan("week_kind_holiday_prep");
                  return (
                    <li key={i}>
                      {fmtDate(start)} — {label}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default TermSyllabusManager;
