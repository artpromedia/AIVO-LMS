"use client";

/**
 * Wave B — parent/teacher school-calendar editor.
 *
 * Captures the learner's term dates + holiday/summer breaks and saves them
 * through the role-scoped BFF (`…/school-calendar`) into brain-svc's
 * `school_calendars` tables. Once saved, pacing-plan generation and
 * holiday-prep activate without re-entering dates: brain-svc reuses the
 * stored calendar whenever a generate request carries none.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type TermRow = { termNumber: number; title: string; startDate: string; endDate: string };
type BreakRow = {
  kind: "holiday" | "break" | "summer";
  name: string;
  startDate: string;
  endDate: string;
};

type LoadedCalendar = {
  name: string | null;
  academicYear: string | null;
  timezone: string;
  terms: Array<{ termNumber: number; title: string | null; startDate: string; endDate: string }>;
  breaks: Array<{ kind: string; name: string | null; startDate: string; endDate: string }>;
};

const BREAK_KINDS: BreakRow["kind"][] = ["holiday", "break", "summer"];

function emptyTerm(n: number): TermRow {
  return { termNumber: n, title: "", startDate: "", endDate: "" };
}

function emptyBreak(): BreakRow {
  return { kind: "holiday", name: "", startDate: "", endDate: "" };
}

export function SchoolCalendarManager({
  apiBase,
  learnerName,
}: Readonly<{
  /** e.g. `/api/bff/parent/learners/${learnerId}/school-calendar` */
  apiBase: string;
  learnerName: string;
}>) {
  const t = useTranslations("curriculum.school_calendar");
  const [academicYear, setAcademicYear] = useState("");
  const [terms, setTerms] = useState<TermRow[]>([emptyTerm(1)]);
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiBase, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const cal = data?.data?.calendar as LoadedCalendar | null;
        if (cancelled || !cal) return;
        setAcademicYear(cal.academicYear ?? "");
        if (cal.terms.length > 0) {
          setTerms(
            cal.terms.map((x) => ({
              termNumber: x.termNumber,
              title: x.title ?? "",
              startDate: x.startDate,
              endDate: x.endDate,
            })),
          );
        }
        setBreaks(
          cal.breaks.map((b) => ({
            kind: (BREAK_KINDS as string[]).includes(b.kind) ? (b.kind as BreakRow["kind"]) : "break",
            name: b.name ?? "",
            startDate: b.startDate,
            endDate: b.endDate,
          })),
        );
      } catch {
        /* first-load read is best-effort; saving surfaces real errors */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  function setTerm(i: number, patch: Partial<TermRow>) {
    setTerms((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function setBreakRow(i: number, patch: Partial<BreakRow>) {
    setBreaks((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function localProblems(): string | null {
    for (const term of terms) {
      if (!term.startDate || !term.endDate) return t("error_missing_dates");
      if (term.endDate < term.startDate) return t("error_end_before_start");
    }
    const sorted = [...terms].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.startDate <= sorted[i - 1]!.endDate) return t("error_terms_overlap");
    }
    for (const br of breaks) {
      if (!br.startDate || !br.endDate) return t("error_missing_dates");
      if (br.endDate < br.startDate) return t("error_end_before_start");
    }
    return null;
  }

  async function onSave() {
    const problem = localProblems();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          academicYear: academicYear || null,
          timezone: "America/Chicago",
          terms: terms.map((term, i) => ({
            termNumber: i + 1,
            title: term.title || null,
            startDate: term.startDate,
            endDate: term.endDate,
          })),
          breaks: breaks.map((b) => ({
            kind: b.kind,
            name: b.name || null,
            startDate: b.startDate,
            endDate: b.endDate,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? t("save_error"));
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setError(t("save_error"));
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "rounded border border-iw-border bg-iw-card px-2 py-1 text-sm";

  return (
    <div className="space-y-4" data-testid="school-calendar-manager">
      <Card className="space-y-3 p-4">
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-sm text-aivo-ink-soft">{t("description", { name: learnerName })}</p>

        <label className="block text-sm">
          {t("academic_year")}{" "}
          <input
            className={inputCls}
            placeholder="2026-2027"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
        </label>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("terms")}</h4>
          {terms.map((term, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2" data-testid="term-row">
              <span className="w-14 text-xs text-aivo-ink-soft">
                {t("term_n", { n: i + 1 })}
              </span>
              <input
                className={inputCls}
                placeholder={t("term_title_placeholder")}
                value={term.title}
                onChange={(e) => setTerm(i, { title: e.target.value })}
              />
              <input
                type="date"
                aria-label={t("start_date")}
                className={inputCls}
                value={term.startDate}
                onChange={(e) => setTerm(i, { startDate: e.target.value })}
              />
              <input
                type="date"
                aria-label={t("end_date")}
                className={inputCls}
                value={term.endDate}
                onChange={(e) => setTerm(i, { endDate: e.target.value })}
              />
              {terms.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTerms((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  {t("remove")}
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTerms((rows) => [...rows, emptyTerm(rows.length + 1)])}
          >
            {t("add_term")}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("breaks")}</h4>
          <p className="text-xs text-aivo-ink-soft">{t("breaks_hint")}</p>
          {breaks.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2" data-testid="break-row">
              <select
                aria-label={t("break_kind")}
                className={inputCls}
                value={b.kind}
                onChange={(e) => setBreakRow(i, { kind: e.target.value as BreakRow["kind"] })}
              >
                {BREAK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kind_${k}`)}
                  </option>
                ))}
              </select>
              <input
                className={inputCls}
                placeholder={t("break_name_placeholder")}
                value={b.name}
                onChange={(e) => setBreakRow(i, { name: e.target.value })}
              />
              <input
                type="date"
                aria-label={t("start_date")}
                className={inputCls}
                value={b.startDate}
                onChange={(e) => setBreakRow(i, { startDate: e.target.value })}
              />
              <input
                type="date"
                aria-label={t("end_date")}
                className={inputCls}
                value={b.endDate}
                onChange={(e) => setBreakRow(i, { endDate: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBreaks((rows) => rows.filter((_, idx) => idx !== i))}
              >
                {t("remove")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBreaks((rows) => [...rows, emptyBreak()])}
          >
            {t("add_break")}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-aivo-danger" role="alert">
            {error}
          </p>
        ) : null}
        {savedAt ? <p className="text-sm text-aivo-success">{t("saved", { time: savedAt })}</p> : null}

        <Button type="button" onClick={onSave} disabled={busy || !loaded}>
          {busy ? t("saving") : t("save")}
        </Button>
      </Card>
    </div>
  );
}
