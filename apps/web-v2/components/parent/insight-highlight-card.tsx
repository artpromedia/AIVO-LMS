/**
 * Insight Highlight card — renders the single data-derived narrative from
 * `deriveInsightHighlight` (mastery trajectory). Always shows where the number
 * came from (source + window + sample size). When there is no qualifying
 * trend yet it renders an honest empty line rather than an invented insight.
 */
import { getTranslations } from "next-intl/server";
import { TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { InsightHighlight } from "@/lib/parent/insight-highlight";

export async function InsightHighlightCard({
  highlight,
  learnerName,
}: {
  highlight: InsightHighlight | null;
  learnerName: string;
}) {
  const t = await getTranslations("parent.insight");

  if (!highlight) {
    return (
      <Card variant="accent" className="flex items-start gap-3 p-[var(--aivo-density-card-pad)]">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-aivo-accent" aria-hidden />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("eyebrow")}
          </p>
          <p className="mt-0.5 text-sm text-aivo-ink-soft">{t("empty", { name: learnerName })}</p>
        </div>
      </Card>
    );
  }

  const up = highlight.direction === "up";
  const Icon = up ? TrendingUp : TrendingDown;
  const headline = up
    ? t("mastery_up", { subject: highlight.subjectName, delta: highlight.deltaPoints })
    : t("mastery_down", { subject: highlight.subjectName, delta: highlight.deltaPoints });

  return (
    <Card variant="accent" className="flex items-start gap-3 p-[var(--aivo-density-card-pad)]">
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${up ? "text-aivo-success" : "text-aivo-danger"}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
          {t("eyebrow")}
        </p>
        <p className="mt-0.5 font-display text-base font-semibold text-iw-text-strong">{headline}</p>
        <p className="mt-0.5 text-sm text-aivo-ink-soft">
          {t("from_to", { from: highlight.fromPct, to: highlight.toPct })} ·{" "}
          {t("window", { days: highlight.windowDays })}
        </p>
        <p className="mt-1 text-xs text-aivo-ink-soft">
          {t("source", { count: highlight.sampleSize })}
        </p>
      </div>
    </Card>
  );
}
