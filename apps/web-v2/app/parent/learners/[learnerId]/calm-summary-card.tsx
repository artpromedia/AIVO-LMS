import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { summarizeCalmForParent } from "@/lib/db/repos";

/** Rolling window for the parent rollup — keeps the copy "this week" calm. */
const CALM_SUMMARY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Read-only, non-clinical "regulation moments" rollup for a parent.
 * Counts only — no raw history, no exact timestamps beyond a coarse
 * relative "last active." Server component: reads the tenant- and
 * learner-scoped repo directly, mirroring the page's server conventions.
 */
export async function CalmSummaryCard({
  learnerId,
  tenantId,
  learnerName,
}: {
  learnerId: string;
  tenantId: string;
  learnerName: string;
}) {
  const t = await getTranslations("parent.calm_summary");
  const sinceIso = new Date(Date.now() - CALM_SUMMARY_WINDOW_MS).toISOString();
  const summary = await summarizeCalmForParent(learnerId, tenantId, { sinceIso });

  let lastActive = "";
  if (summary.lastSessionAt) {
    const diffDays = Math.floor(
      (Date.now() - new Date(summary.lastSessionAt).getTime()) / (24 * 60 * 60 * 1000),
    );
    lastActive =
      diffDays <= 0
        ? t("last_active_today")
        : diffDays === 1
          ? t("last_active_yesterday")
          : t("last_active_days", { count: diffDays });
  }

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
        {t("title")}
      </p>
      {summary.totalMoments === 0 ? (
        <p className="mt-2 text-sm text-iw-ink-muted">{t("none", { name: learnerName })}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <p className="text-iw-text-strong">
            {t("moments", { name: learnerName, count: summary.totalMoments })}
          </p>
          <p className="text-iw-ink-muted">
            {t("completed", { count: summary.completedMoments })}
          </p>
          {lastActive ? <p className="text-iw-ink-muted">{lastActive}</p> : null}
        </div>
      )}
    </Card>
  );
}
