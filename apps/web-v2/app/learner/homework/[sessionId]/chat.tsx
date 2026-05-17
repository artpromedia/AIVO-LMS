"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HomeworkHelpMessage } from "@/lib/db/types";

export function HomeworkChat({
  learnerId,
  sessionId,
  initialMessages,
}: {
  learnerId: string;
  sessionId: string;
  initialMessages: HomeworkHelpMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<HomeworkHelpMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/bff/learners/${learnerId}/homework/${sessionId}/message`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        },
      );
      const body = (await res.json()) as {
        ok: boolean;
        data?: { session: { messages: HomeworkHelpMessage[] } };
        error?: { message: string };
      };
      if (!res.ok || !body.ok || !body.data) {
        setError(body.error?.message ?? "Couldn't send. Try again.");
        return;
      }
      setMessages(body.data.session.messages);
      setText("");
    } catch {
      setError("Network problem. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bff/learners/${learnerId}/homework/${sessionId}/complete`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message: string };
        } | null;
        setError(body?.error?.message ?? "Couldn't end the session.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network problem. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <ol className="grid gap-3" aria-live="polite" aria-label="Conversation">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex ${m.role === "learner" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "learner"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div ref={endRef} />
      </Card>

      <form onSubmit={send} className="grid gap-2">
        <label htmlFor="hw-reply" className="sr-only">
          Your message
        </label>
        <textarea
          id="hw-reply"
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Type what you tried or ask a question…"
          className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? "Sending…" : "Send"}
          </Button>
          <Button type="button" variant="soft" onClick={complete} disabled={busy}>
            I'm done — wrap up
          </Button>
        </div>
      </form>
    </div>
  );
}
