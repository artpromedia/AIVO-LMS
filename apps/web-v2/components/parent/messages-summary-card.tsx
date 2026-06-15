/**
 * Parent Home "Messages" card — surfaces real unread state + the latest thread
 * from the care-team inbox, linking to /messages. Honest empty state before any
 * conversation exists (no invented "Coach" message).
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MessageCircle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { MessagesSummary } from "@/lib/messaging/summary";

export async function MessagesSummaryCard({ summary }: { summary: MessagesSummary }) {
  const t = await getTranslations("parent.messages_card");

  return (
    <Card className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-aivo-accent" aria-hidden />
          <p className="font-display font-semibold text-iw-text-strong">{t("title")}</p>
        </div>
        {summary.unread > 0 ? (
          <span
            className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-iw-primary px-2 py-0.5 text-xs font-semibold leading-none text-iw-primary-fg"
            aria-label={t("unread", { count: summary.unread })}
          >
            {summary.unread > 99 ? "99+" : summary.unread}
          </span>
        ) : null}
      </div>

      {summary.latest ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-iw-text-strong">
            {summary.latest.subject}
          </p>
          {summary.latest.snippet ? (
            <p className="truncate text-xs text-aivo-ink-soft">{summary.latest.snippet}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-aivo-ink-soft">{t("empty")}</p>
      )}

      <Link
        href="/messages"
        className="inline-flex items-center gap-1 text-sm font-medium text-aivo-accent hover:underline"
      >
        {summary.latest ? t("open") : t("start")}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Card>
  );
}
