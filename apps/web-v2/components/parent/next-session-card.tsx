/**
 * Parent Home "Next session" card — the soonest upcoming human coach/therapy
 * session across the family, from real bookings. Honest empty state when none
 * is scheduled (no fabricated provider or time).
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarClock, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export type NextSession = {
  learnerId: string;
  providerName: string;
  kind: "coach" | "therapist";
  scheduledStart: string;
} | null;

export async function NextSessionCard({ next }: { next: NextSession }) {
  const t = await getTranslations("parent.next_session");

  return (
    <Card className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)]">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-aivo-primary" aria-hidden />
        <p className="font-display font-semibold text-iw-text-strong">{t("title")}</p>
      </div>
      {next ? (
        <>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-iw-text-strong">
              {next.providerName} · {t(`kind_${next.kind}`)}
            </p>
            <p className="text-xs text-aivo-ink-soft">
              {new Date(next.scheduledStart).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <Link
            href={`/parent/learners/${next.learnerId}/sessions`}
            className="inline-flex items-center gap-1 text-sm font-medium text-aivo-accent hover:underline"
          >
            {t("manage")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </>
      ) : (
        <p className="text-sm text-aivo-ink-soft">{t("empty")}</p>
      )}
    </Card>
  );
}
