"use client";

/**
 * Client-side notifications list with live updates.
 *
 * Hydrates from the server-rendered initial list, then subscribes via
 * `useNotificationStream` (SSE primary, polling fallback). Mark-as-read
 * is optimistic; the server reconciles on the next refresh tick.
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useNotificationStream,
  type NotificationItem,
} from "@/lib/notifications/useNotificationStream";

interface NotificationsListProps {
  fetchUrl: string;
  sseUrl?: string;
  markReadUrl?: string;
  initial: NotificationItem[];
  emptyTitle: string;
  emptyDescription: string;
}

export function LearnerNotificationsList({
  fetchUrl,
  sseUrl,
  markReadUrl,
  initial,
  emptyTitle,
  emptyDescription,
}: NotificationsListProps) {
  const { notifications, markRead } = useNotificationStream({
    fetchUrl,
    sseUrl,
    markReadUrl,
  });

  const items = notifications.length > 0 ? notifications : initial;

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3" aria-live="polite">
      {items.map((n) => (
        <Card
          key={n.id}
          className={`p-4 ${n.readAt ? "opacity-70" : ""}`}
          onClick={() => {
            if (!n.readAt) void markRead(n.id);
          }}
        >
          <div className="flex items-center gap-2">
            <p className="font-medium">{n.title}</p>
            {!n.readAt ? <Badge tone="primary">New</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-iw-ink-muted">{n.body}</p>
        </Card>
      ))}
    </div>
  );
}
