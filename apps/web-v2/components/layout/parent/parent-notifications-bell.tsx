"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { bffFetch } from "@/lib/api/client";
import styles from "./parent-chrome.module.css";

/**
 * Top-bar notifications bell (ParentApp.dc.html). Links to the parent
 * Notifications screen and shows the real unread count from
 * `/api/bff/me/notifications/unread-count` (the same source the learner badge
 * uses). Renders no badge at zero/unknown so the chrome stays calm.
 */
export function ParentNotificationsBell() {
  const t = useTranslations("parent.shell");
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    bffFetch<{ unread: number }>("/api/bff/me/notifications/unread-count", { cache: "no-store" })
      .then((d) => {
        if (alive) setCount(d.unread);
      })
      .catch(() => {
        /* keep the bell quiet if the count is unavailable */
      });
    return () => {
      alive = false;
    };
  }, []);

  const display = count && count > 0 ? (count > 99 ? "99+" : String(count)) : null;

  return (
    <Link
      href="/parent/notifications"
      aria-label={display ? t("notifications_unread", { count: count ?? 0 }) : t("notifications")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-iw-border bg-iw-raised text-iw-ink-muted shadow-sm transition-colors hover:border-iw-text-muted hover:text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
    >
      <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
      {display ? (
        <span
          className={`${styles.badge} absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold`}
        >
          {display}
        </span>
      ) : null}
    </Link>
  );
}
