"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  Sparkles,
  BarChart3,
  Flame,
  ShieldCheck,
  Users,
  FileCheck2,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { bffFetch } from "@/lib/api/client";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import styles from "./live-updates-card.module.css";

type ActivityKind =
  | "lesson"
  | "tutor"
  | "mastery"
  | "streak"
  | "iep"
  | "consent"
  | "team";

interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  text: string;
  occurredAt: string;
  learnerId: string;
}

interface ActivityResponse {
  events: ActivityEvent[];
  nextCursor: string | null;
}

/** Visible items + poll cadence — calm, not frantic (neurodiverse-first). */
const FEED_LIMIT = 6;
const POLL_MS = 15_000;

/**
 * Per-kind icon + token-based tint. Colors resolve through the brand CSS vars
 * so there are no inline hex values (the app's lint rule forbids them) and the
 * palette tracks sensory modes.
 */
const KIND_STYLE: Record<ActivityKind, { Icon: LucideIcon; wrap: string }> = {
  lesson: {
    Icon: BookOpen,
    wrap: "bg-[var(--aivo-domain-completion-complete-subtle)] text-[var(--aivo-domain-completion-complete-strong)]",
  },
  mastery: {
    Icon: BarChart3,
    wrap: "bg-[var(--aivo-domain-completion-complete-subtle)] text-[var(--aivo-domain-completion-complete-strong)]",
  },
  tutor: { Icon: Sparkles, wrap: "bg-[var(--aivo-aivoTeal-100)] text-[var(--aivo-aivoTeal-700)]" },
  iep: { Icon: ShieldCheck, wrap: "bg-[var(--aivo-aivoTeal-100)] text-[var(--aivo-aivoTeal-700)]" },
  streak: { Icon: Flame, wrap: "bg-iw-warm-soft text-[var(--aivo-status-warning)]" },
  team: { Icon: Users, wrap: "bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)]" },
  consent: {
    Icon: FileCheck2,
    wrap: "bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)]",
  },
};

function useRelativeTime(locale: string, justNow: string) {
  return React.useCallback(
    (iso: string): string => {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
      if (mins < 1) return justNow;
      if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
      const hrs = Math.round(mins / 60);
      if (Math.abs(hrs) < 24) return rtf.format(-hrs, "hour");
      return rtf.format(-Math.round(hrs / 24), "day");
    },
    [locale, justNow],
  );
}

/**
 * Parent / caregiver home "Live updates" card.
 *
 * Streams one learner's real, recent activity from
 * `/api/bff/parent/activity`. The initial load + cache come from react-query;
 * `useLiveRefresh` drives the visibility-aware poll (pauses on a backgrounded
 * tab, no overlapping requests) the design calls for — the single primitive
 * that upgrades to SSE/WebSocket later without touching this component.
 */
export function LiveUpdatesCard({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const t = useTranslations("parent.home_v2");
  const locale = useLocale();
  const rel = useRelativeTime(locale, t("live_just_now"));

  const query = useQuery({
    queryKey: ["parent-activity", learnerId],
    queryFn: () =>
      bffFetch<ActivityResponse>(
        `/api/bff/parent/activity?learnerId=${encodeURIComponent(learnerId)}&limit=${FEED_LIMIT}`,
      ),
  });

  // Visibility-aware live polling. Caller owns the initial load (react-query),
  // so this only refreshes; the hook's in-flight guard + react-query dedupe
  // keep ticks from stacking up.
  useLiveRefresh(() => query.refetch().then(() => undefined), POLL_MS, {
    enabled: !query.isError,
  });

  const events = query.data?.events ?? [];

  return (
    <section
      className="flex flex-col rounded-iw-card-lg border border-iw-border bg-white p-5 shadow-soft-3 sm:p-6"
      aria-label={t("live_updates_title")}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-iw-text-strong sm:text-lg">
          {t("live_updates_title")}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--aivo-domain-completion-complete-strong)]">
          <span
            className={`${styles.liveDot} bg-[var(--aivo-domain-completion-complete-strong)]`}
            aria-hidden
          />
          {t("live_badge")}
        </span>
      </div>
      <p className="mt-1 text-sm text-iw-text-muted">
        {t("live_subtitle", { name: learnerName })}
      </p>

      <div className="mt-2 flex-1" aria-live="polite">
        {query.isPending ? (
          <ul className="flex flex-col" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-iw-border/60 py-3">
                <span className="h-[30px] w-[30px] shrink-0 animate-pulse rounded-iw-control bg-iw-card" />
                <span className="mt-1 h-3 w-3/4 animate-pulse rounded bg-iw-card" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <div className="flex flex-col items-start gap-2 py-4 text-sm text-iw-text-muted">
            <span className="inline-flex items-center gap-2">
              <Radio size={16} aria-hidden /> {t("live_error")}
            </span>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="rounded-iw-control border border-iw-border bg-white px-3 py-1.5 text-xs font-semibold text-iw-text-strong hover:bg-iw-card"
            >
              {t("live_retry")}
            </button>
          </div>
        ) : events.length === 0 ? (
          <p className="py-6 text-sm text-iw-text-muted">{t("live_empty")}</p>
        ) : (
          <ul className="flex flex-col">
            {events.map((e) => {
              const { Icon, wrap } = KIND_STYLE[e.kind] ?? KIND_STYLE.lesson;
              return (
                <li
                  key={e.id}
                  className={`${styles.row} flex items-start gap-3 border-b border-iw-border/60 py-3 last:border-b-0`}
                >
                  <span
                    className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-iw-control ${wrap}`}
                    aria-hidden
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-iw-text-strong">{e.text}</p>
                    <p className="mt-0.5 text-[11px] text-iw-text-muted">{rel(e.occurredAt)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

LiveUpdatesCard.displayName = "Parent/LiveUpdatesCard";
