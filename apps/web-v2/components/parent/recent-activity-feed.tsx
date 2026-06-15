/**
 * Recent Activity feed — renders the aggregated, real `ActivityItem[]` from
 * `getRecentActivity`. Each row is a genuine persisted event (lesson
 * completion, caregiver observation, therapist note, pending recommendation).
 * Empty feed → honest empty state.
 */
import type { ComponentType } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookOpenCheck, Eye, ClipboardList, Sparkles, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActivityItem, ActivityKind } from "@/lib/parent/recent-activity";

const ICON: Record<ActivityKind, ComponentType<{ className?: string }>> = {
  lesson: BookOpenCheck,
  observation: Eye,
  therapy_note: ClipboardList,
  recommendation: Sparkles,
};

const ICON_TONE: Record<ActivityKind, string> = {
  lesson: "text-aivo-accent",
  observation: "text-aivo-success",
  therapy_note: "text-aivo-primary",
  recommendation: "text-aivo-accent",
};

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export async function RecentActivityFeed({ items }: { items: ActivityItem[] }) {
  const t = await getTranslations("parent.activity");

  if (items.length === 0) {
    return <EmptyState title={t("empty_title")} description={t("empty_body")} />;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label={t("aria_list")}>
      {items.map((it) => {
        const Icon = ICON[it.kind];
        return (
          <li
            key={it.id}
            className="flex items-start gap-3 rounded-iw-control border border-iw-border bg-iw-card p-3"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_TONE[it.kind]}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-iw-text-strong">{t(it.titleKey, it.params)}</p>
              {it.detail ? (
                <p className="mt-0.5 truncate text-xs text-aivo-ink-soft">{it.detail}</p>
              ) : null}
              <time dateTime={it.at} className="mt-0.5 block text-xs text-aivo-ink-soft">
                {dateLabel(it.at)}
              </time>
            </div>
            {it.href ? (
              <Link
                href={it.href}
                className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-aivo-accent hover:underline"
              >
                {t("view")}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
