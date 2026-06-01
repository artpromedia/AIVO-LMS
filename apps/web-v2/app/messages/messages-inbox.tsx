"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

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
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Threaded inbox for `/messages`. Lists the signed-in user's threads, opens a
 * thread, and lets them reply. Backed by `/api/bff/messages/*` (dual-path:
 * comms-svc when enabled, in-memory store in dev/mock).
 */
export function MessagesInbox() {
  const [threads, setThreads] = React.useState<ThreadListItem[]>([]);
  const [loadingThreads, setLoadingThreads] = React.useState(true);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeSubject, setActiveSubject] = React.useState<string>("");
  const [messages, setMessages] = React.useState<ThreadMessage[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, startSend] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const loadThreads = React.useCallback(async () => {
    try {
      const res = await fetch("/api/bff/messages/threads");
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.data?.threads) setThreads(j.data.threads as ThreadListItem[]);
    } catch {
      setError("Couldn't load your messages.");
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  React.useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const openThread = React.useCallback(
    async (id: string, subject: string) => {
      setActiveId(id);
      setActiveSubject(subject);
      setMessages(null);
      setError(null);
      try {
        const res = await fetch(`/api/bff/messages/threads/${id}/messages`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.data) {
          setMessages((j.data.messages ?? []) as ThreadMessage[]);
          void fetch(`/api/bff/messages/threads/${id}/read`, { method: "POST" });
          setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
        } else {
          setError("Couldn't open that conversation.");
        }
      } catch {
        setError("Couldn't open that conversation.");
      }
    },
    [],
  );

  function send() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setError(null);
    startSend(async () => {
      const res = await fetch(`/api/bff/messages/threads/${activeId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? "Couldn't send your message.");
        return;
      }
      setMessages((prev) => [...(prev ?? []), j.data.message as ThreadMessage]);
      setDraft("");
      void loadThreads();
    });
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[320px,1fr]">
      {/* Thread list */}
      <aside className="rounded-iw-card border border-iw-border bg-iw-card">
        <header className="border-b border-iw-border px-4 py-3">
          <h2 className="text-sm font-semibold text-iw-text-strong">Inbox</h2>
        </header>
        {loadingThreads ? (
          <p className="px-4 py-6 text-sm text-iw-text-muted">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-iw-text-muted">
            No conversations yet. When someone on your AIVO team messages you it will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-iw-border">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void openThread(t.id, t.subject)}
                  aria-current={t.id === activeId}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-iw-raised ${
                    t.id === activeId ? "bg-iw-raised" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-iw-text-strong">
                      {t.subject}
                    </span>
                    {t.unread > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--aivo-sensory-primary)] px-1.5 text-xs font-semibold text-white">
                        {t.unread}
                      </span>
                    ) : null}
                  </span>
                  {t.lastMessage ? (
                    <span className="truncate text-xs text-iw-text-muted">{t.lastMessage.body}</span>
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
            Select a conversation to read and reply.
          </div>
        ) : (
          <>
            <header className="border-b border-iw-border px-4 py-3">
              <h2 className="text-sm font-semibold text-iw-text-strong">{activeSubject}</h2>
            </header>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages === null ? (
                <p className="text-sm text-iw-text-muted">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-iw-text-muted">No messages in this conversation yet.</p>
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
                    <span className="mt-1 text-[11px] text-iw-text-muted">{timeLabel(m.createdAt)}</span>
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
                  placeholder="Write a reply…"
                  aria-label="Write a reply"
                  className="flex-1 resize-none rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm text-iw-text-strong outline-none focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20"
                />
                <Button size="sm" disabled={sending || draft.trim().length === 0} onClick={send}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {error ? (
        <p role="alert" className="text-sm text-aivo-danger lg:col-span-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
