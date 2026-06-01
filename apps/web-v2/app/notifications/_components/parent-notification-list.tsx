"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/lib/db/types";

export function ParentNotificationList({ notifications: initial }: { notifications: Notification[] }) {
  const t = useTranslations("parent.notifications");
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  async function markRead(ids: string[]) {
    const res = await fetch("/api/bff/notifications/mark-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const body = await res.json();
    if (!body.ok) return;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n)),
    );
  }

  const unread = items.filter((n) => !n.readAt);

  return (
    <div className="space-y-3">
      {unread.length > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-aivo-muted">{t("unread_count", { count: unread.length })}</p>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void markRead(unread.map((n) => n.id));
              })
            }
          >
            {t("mark_all_read")}
          </Button>
        </div>
      ) : null}
      {items.map((n) => (
        <Card key={n.id} className={`p-4 ${n.readAt ? "opacity-70" : "border-aivo-primary/40"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{n.title}</p>
                {!n.readAt ? <Badge tone="primary">{t("new_badge")}</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-aivo-ink-soft">{n.body}</p>
              <p className="mt-1 text-xs text-aivo-muted">
                {new Date(n.createdAt).toLocaleString()} · {n.type}
              </p>
            </div>
            {!n.readAt ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void markRead([n.id]);
                  })
                }
              >
                {t("mark_read")}
              </Button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
