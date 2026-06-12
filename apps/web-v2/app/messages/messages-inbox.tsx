"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryPanel } from "@/components/ui/retry-panel";
import { bffFetch } from "@/lib/api/client";
import { toast } from "@/lib/use-toast";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useSse } from "@/lib/realtime/use-sse";

interface ThreadListItem {
  id: string;
  subject: string;
  lastMessageAt: string;
  unread: number;
  lastMessage: { body: string; senderUserId: string; createdAt: string } | null;
}

interface ThreadMessage {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const THREADS_KEY = ["messages", "threads"] as const;
const threadMessagesKey = (id: string) => ["messages", "thread", id] as const;

/**
 * Threaded inbox for `/messages`. Lists the signed-in user's threads, opens a
 * thread, and lets them reply. Backed by `/api/bff/messages/*` (dual-path:
 * comms-svc when enabled, in-memory store in dev/mock).
 *
 * Data layer: TanStack Query over `bffFetch` — list + thread reads cache and
 * retry through the shared client; SSE pushes append straight into the query
 * cache; the 6s/12s polling stays as the documented fallback. Send failures
 * surface a danger toast with a retry action and never clear the draft.
 */
export function MessagesInbox() {
  const t = useTranslations("messages");
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeSubject, setActiveSubject] = React.useState<string>("");
  const [draft, setDraft] = React.useState("");

  const threadsQuery = useQuery({
    queryKey: THREADS_KEY,
    queryFn: () => bffFetch<{ threads: ThreadListItem[] }>("/api/bff/messages/threads"),
  });
  const threads = threadsQuery.data?.threads ?? [];

  const messagesQuery = useQuery({
    queryKey: threadMessagesKey(activeId ?? "none"),
    queryFn: () =>
      bffFetch<{ messages: ThreadMessage[] }>(`/api/bff/messages/threads/${activeId}/messages`),
    enabled: activeId !== null,
  });
  const messages = activeId === null ? null : (messagesQuery.data?.messages ?? null);

  // Live updates: prefer cross-replica SSE fan-out from comms-svc (a NATS
  // subject keyed by thread id). When the stream is open we skip the
  // polling fallback; when it errors out (server disabled, network
  // hiccup, BFF 503) the polling cadence below picks the load back up.
  // Polling is the documented fallback, not the primary path.
  const sse = useSse(activeId ? `/api/bff/messages/threads/${activeId}/stream` : null, {
    enabled: !!activeId,
    onNamedEvent: (name, data) => {
      if (name !== "message" || !activeId) return;
      const payload = data as { type?: string; message?: ThreadMessage } | null;
      if (payload?.type !== "message.created" || !payload.message) return;
      queryClient.setQueryData<{ messages: ThreadMessage[] }>(
        threadMessagesKey(activeId),
        (prev) => {
          const next = prev?.messages ? [...prev.messages] : [];
          // Dedupe — a poll might have raced us to the same row.
          if (next.some((m) => m.id === payload.message!.id)) return prev ?? { messages: next };
          next.push(payload.message!);
          return { messages: next };
        },
      );
      // Thread list lastMessage/unread also need to refresh; cheap.
      void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
    },
  });
  const streamHealthy = sse.state === "open";

  const refetchThreads = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: THREADS_KEY }),
    [queryClient],
  );
  const refetchActive = React.useCallback(async () => {
    if (activeId) await queryClient.invalidateQueries({ queryKey: threadMessagesKey(activeId) });
  }, [queryClient, activeId]);

  useLiveRefresh(refetchThreads, 12000);
  useLiveRefresh(refetchActive, 6000, { enabled: activeId !== null && !streamHealthy });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      bffFetch(`/api/bff/messages/threads/${id}/read`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<{ threads: ThreadListItem[] }>(THREADS_KEY, (prev) =>
        prev
          ? { threads: prev.threads.map((th) => (th.id === id ? { ...th, unread: 0 } : th)) }
          : prev,
      );
    },
  });

  const openThread = React.useCallback(
    (id: string, subject: string) => {
      setActiveId(id);
      setActiveSubject(subject);
      markRead.mutate(id);
    },
    [markRead],
  );

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      bffFetch<{ message: ThreadMessage }>(`/api/bff/messages/threads/${activeId}/messages`, {
        method: "POST",
        body: { body },
      }),
    onSuccess: (data) => {
      if (activeId) {
        queryClient.setQueryData<{ messages: ThreadMessage[] }>(
          threadMessagesKey(activeId),
          (prev) => ({ messages: [...(prev?.messages ?? []), data.message] }),
        );
      }
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: THREADS_KEY });
    },
    onError: (_err, body) => {
      // Draft is preserved; the toast offers a one-tap retry.
      toast({
        title: t("send_failed_title"),
        description: t("send_failed_body"),
        variant: "danger",
        action: { label: t("send_retry"), onClick: () => sendMutation.mutate(body) },
      });
    },
  });

  function send() {
    const body = draft.trim();
    if (!body || !activeId || sendMutation.isPending) return;
    sendMutation.mutate(body);
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[320px,1fr]">
      {/* Thread list */}
      <aside className="rounded-iw-card border border-iw-border bg-iw-card">
        <header className="border-b border-iw-border px-4 py-3">
          <h2 className="text-sm font-semibold text-iw-text-strong">{t("inbox_title")}</h2>
        </header>
        {threadsQuery.isPending ? (
          <div className="flex flex-col gap-3 px-4 py-4" aria-busy="true">
            <span className="sr-only">{t("loading")}</span>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-5/6" />
          </div>
        ) : threadsQuery.isError ? (
          <RetryPanel
            className="m-3"
            title={t("threads_error_title")}
            message={t("threads_error_body")}
            onRetry={() => threadsQuery.refetch()}
          />
        ) : threads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-iw-text-muted">{t("empty_inbox")}</p>
        ) : (
          <ul className="divide-y divide-iw-border">
            {threads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  onClick={() => openThread(th.id, th.subject)}
                  aria-current={th.id === activeId}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-iw-raised ${
                    th.id === activeId ? "bg-iw-raised" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-iw-text-strong">
                      {th.subject}
                    </span>
                    {th.unread > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--aivo-sensory-primary)] px-1.5 text-xs font-semibold text-white">
                        {th.unread}
                      </span>
                    ) : null}
                  </span>
                  {th.lastMessage ? (
                    <span className="truncate text-xs text-iw-text-muted">
                      {th.lastMessage.body}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Thread view */}
      <section className="flex min-h-[420px] flex-col rounded-iw-card border border-iw-border bg-iw-card">
        {activeId === null ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-iw-text-muted">
            {t("select_prompt")}
          </div>
        ) : (
          <>
            <header className="border-b border-iw-border px-4 py-3">
              <h2 className="text-sm font-semibold text-iw-text-strong">{activeSubject}</h2>
            </header>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messagesQuery.isError ? (
                <RetryPanel
                  title={t("thread_error_title")}
                  message={t("thread_error_body")}
                  onRetry={() => messagesQuery.refetch()}
                />
              ) : messages === null ? (
                <div className="flex flex-col gap-3" aria-busy="true">
                  <span className="sr-only">{t("loading")}</span>
                  <Skeleton className="h-10 w-3/5" />
                  <Skeleton className="ml-auto h-10 w-2/5" />
                  <Skeleton className="h-10 w-1/2" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-iw-text-muted">{t("empty_thread")}</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-iw-control px-3.5 py-2.5 text-sm ${
                        m.mine
                          ? "bg-[var(--aivo-sensory-primary)] text-white"
                          : "bg-iw-raised text-iw-text-strong"
                      }`}
                    >
                      {m.body}
                    </div>
                    <span className="mt-1 text-[11px] text-iw-text-muted">
                      {timeLabel(m.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-iw-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder={t("reply_placeholder")}
                  aria-label={t("reply_placeholder")}
                  className="flex-1 resize-none rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm text-iw-text-strong outline-none focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20"
                />
                <Button
                  size="sm"
                  disabled={sendMutation.isPending || draft.trim().length === 0}
                  onClick={send}
                >
                  {sendMutation.isPending ? t("sending") : t("send")}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
