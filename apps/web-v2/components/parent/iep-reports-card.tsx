import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AivoIcon } from "@aivo/ui/icon";
import type { LearnerReportKpis } from "@/lib/parent/report-kpis";

/** Rotating, token-based bar colors for the subject progress rows. */
const BAR_COLORS = [
  "bg-[var(--aivo-domain-completion-complete-strong)]",
  "bg-[var(--aivo-aivoTeal-700)]",
  "bg-[var(--aivo-sensory-primary)]",
];

function Delta({ deltaPct, period }: { deltaPct: number | null; period: string }) {
  if (deltaPct == null) {
    return <span className="text-[11px] font-semibold text-iw-text-muted">{period}</span>;
  }
  const up = deltaPct >= 0;
  return (
    <span
      className={`text-[11px] font-semibold ${
        up
          ? "text-[var(--aivo-domain-completion-complete-strong)]"
          : "text-[var(--aivo-status-error-strong)]"
      }`}
    >
      {up ? "↑" : "↓"} {Math.abs(deltaPct)}% · {period}
    </span>
  );
}

/**
 * Parent home "IEP reports" card.
 *
 * Surfaces the same real KPIs as `/parent/reports` (overall mastery, lessons
 * completed, IEP supports) plus per-subject mastery bars, all read from
 * `computeLearnerReportKpis`. Links into the learner's full IEP report. The
 * "Download PDF" affordance from the design depends on the report-render job
 * (BACKEND-WIRING "design-only" #3) and lands with that backend.
 */
export async function IepReportsCard({
  kpis,
  learnerId,
}: {
  kpis: LearnerReportKpis;
  learnerId: string;
}) {
  const t = await getTranslations("parent.home_v2");
  const period = t("iep_period_30d");

  return (
    <section
      className="flex flex-col rounded-iw-card-lg border border-iw-border bg-white p-5 shadow-soft-3 sm:p-6"
      aria-label={t("iep_reports_title")}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-iw-control bg-[var(--aivo-domain-completion-complete-subtle)] text-[var(--aivo-domain-completion-complete-strong)]">
            <AivoIcon name="iep" size={18} />
          </span>
          <h3 className="text-base font-semibold text-iw-text-strong sm:text-lg">
            {t("iep_reports_title")}
          </h3>
        </div>
        <a
          href={`/api/bff/parent/learners/${learnerId}/iep-report`}
          download
          className="inline-flex items-center gap-1.5 rounded-iw-control border border-[var(--aivo-aivoPurple-200)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:bg-iw-card"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          </svg>
          {t("iep_download_pdf")}
        </a>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-iw-control border border-iw-border bg-iw-bg p-3">
          <p className="text-[11px] font-semibold text-iw-text-muted">{t("iep_overall_mastery")}</p>
          <p className="text-xl font-bold text-[var(--aivo-aivoTeal-700)]">
            {kpis.overallMasteryPct}%
          </p>
          <Delta deltaPct={kpis.overallMasteryDeltaPct} period={period} />
        </div>
        <div className="rounded-iw-control border border-iw-border bg-iw-bg p-3">
          <p className="text-[11px] font-semibold text-iw-text-muted">{t("iep_lessons_done")}</p>
          <p className="text-xl font-bold text-[var(--aivo-sensory-primary)]">
            {kpis.completedCount}
          </p>
          <Delta deltaPct={kpis.completedDeltaPct} period={period} />
        </div>
        <div className="rounded-iw-control border border-iw-border bg-iw-bg p-3">
          <p className="text-[11px] font-semibold text-iw-text-muted">{t("iep_supports")}</p>
          <p className="text-xl font-bold text-[var(--aivo-aivoTeal-700)]">
            {kpis.iepSupportsCount > 0
              ? t("iep_supports_on", { count: kpis.iepSupportsCount })
              : t("iep_supports_none")}
          </p>
          <span className="text-[11px] font-semibold text-iw-text-muted">
            {kpis.iepActive ? t("iep_supports_active") : t("iep_supports_optional")}
          </span>
        </div>
      </div>

      {kpis.subjectProgress.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3">
          {kpis.subjectProgress.map((s, i) => (
            <div key={s.subjectId}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-iw-text-strong">{s.subject}</span>
                <span className="font-bold text-iw-text-strong">{s.pct}%</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-iw-card">
                <div
                  className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-sm text-iw-text-muted">{t("iep_no_mastery")}</p>
      )}

      <footer className="mt-auto pt-1">
        <Link
          href={`/parent/learners/${learnerId}/iep`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
        >
          {t("iep_view_full")}
          <AivoIcon name="goal" size={14} />
        </Link>
      </footer>
    </section>
  );
}

IepReportsCard.displayName = "Parent/IepReportsCard";
