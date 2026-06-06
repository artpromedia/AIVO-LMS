"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { HomeworkHelpMessage } from "@/lib/db/types";
import { observeFocus, type FocusObservation } from "@/lib/homework/focus";

/** How often we re-evaluate focus from local signals (drives inactivity). */
const FOCUS_POLL_MS = 15_000;
/** Two sends closer together than this count as a rapid resend. */
const RAPID_RESEND_MS = 12_000;
/** After a dismiss, suppress re-tripping for this long. */
const NUDGE_COOLDOWN_MS = 120_000;

export function HomeworkChat({
  learnerId,
  sessionId,
  initialMessages,
  regulationEnabled = false,
}: {
  learnerId: string;
  sessionId: string;
  initialMessages: HomeworkHelpMessage[];
  regulationEnabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("learner.homework");
  const [messages, setMessages] = useState<HomeworkHelpMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Lightweight, local-only focus signals — never sent anywhere.
  const lastActivityRef = useRef<number>(Date.now());
  const lastSendRef = useRef<number>(0);
  const rapidResendsRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const busyRef = useRef<boolean>(false);
  const [nudge, setNudge] = useState<FocusObservation | null>(null);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Evaluate the (frustration/break) signals and surface a single calm
  // nudge. Never interrupts an in-flight send, never stacks, and honours
  // the post-dismiss cooldown.
  const evaluateFocus = useCallback(() => {
    if (!regulationEnabled || busyRef.current) return;
    setNudge((current) => {
      if (current) return current; // already showing — don't replace/stack
      if (Date.now() < cooldownUntilRef.current) return null;
      const observation = observeFocus({
        inactivityMs: Date.now() - lastActivityRef.current,
        consecutiveWrongAttempts: rapidResendsRef.current,
      });
      return observation.state === "frustrated" || observation.state === "needs_break"
        ? observation
        : null;
    });
  }, [regulationEnabled]);

  useEffect(() => {
    if (!regulationEnabled) return;
    const id = window.setInterval(evaluateFocus, FOCUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [regulationEnabled, evaluateFocus]);

  const dismissNudge = useCallback(() => {
    cooldownUntilRef.current = Date.now() + NUDGE_COOLDOWN_MS;
    setNudge(null);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) return;
    // Track rapid consecutive resends (a frustration proxy) before sending.
    const now = Date.now();
    rapidResendsRef.current =
      lastSendRef.current && now - lastSendRef.current <= RAPID_RESEND_MS
        ? rapidResendsRef.current + 1
        : 0;
    lastSendRef.current = now;
    markActivity();
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/homework/${sessionId}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { session: { messages: HomeworkHelpMessage[] } };
        error?: { message: string };
      };
      if (!res.ok || !body.ok || !body.data) {
        setError(body.error?.message ?? t("err_send"));
        return;
      }
      setMessages(body.data.session.messages);
      setText("");
    } catch {
      setError(t("err_network"));
    } finally {
      setBusy(false);
      // Re-evaluate once the send has fully settled (never mid-flight).
      if (regulationEnabled) window.setTimeout(evaluateFocus, 0);
    }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/homework/${sessionId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message: string };
        } | null;
        setError(body?.error?.message ?? t("err_end"));
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t("err_network_short"));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <ol className="grid gap-3" aria-live="polite" aria-label={t("conversation_aria")}>
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

      {/* Calm nudge — gentle, inline, dismissible; never a modal and never
          blocks the chat. Announced politely so it doesn't steal focus. */}
      <div aria-live="polite">
        {nudge ? (
          <Card className="border-aivo-primary bg-aivo-primary/5 p-4">
            <h2 className="font-display text-lg font-semibold text-iw-text-strong">
              {t("calm_nudge.title")}
            </h2>
            <p className="mt-1 text-sm text-aivo-ink-soft">{t("calm_nudge.body")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/learner/calm?action=${nudge.recommendedAction}`}>
                  {t("calm_nudge.accept")}
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={dismissNudge}>
                {t("calm_nudge.dismiss")}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <form onSubmit={send} className="grid gap-2">
        <label htmlFor="hw-reply" className="sr-only">
          {t("reply_label")}
        </label>
        <textarea
          id="hw-reply"
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            markActivity();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          placeholder={t("input_placeholder")}
          className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? t("sending") : t("send")}
          </Button>
          <Button type="button" variant="soft" onClick={complete} disabled={busy}>
            {t("wrap_up")}
          </Button>
        </div>
      </form>
    </div>
  );
}
