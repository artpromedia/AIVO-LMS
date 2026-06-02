"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TutorMessage, TutorInsightChip } from "@aivo/ui";

type Turn = { id: string; role: "learner" | "tutor"; text: string; blocked?: boolean };

/**
 * Sprint 4 (learner roadmap): real Socratic chat island that replaces
 * the canned `<TutorMessage>` demo on /learner/tutor.
 *
 * Posts each learner message to the stateless
 * `/api/bff/learners/[learnerId]/tutor/reply` route, which runs the
 * same safety pipeline as the homework helper. History lives entirely
 * on the client; nothing is persisted server-side. The first tutor
 * message is a static greeting so the chat doesn't open empty.
 */
export function LearnerTutorChat({
  learnerId,
  greeting,
  preferredName,
}: {
  readonly learnerId: string;
  readonly greeting: string;
  readonly preferredName: string;
}) {
  const t = useTranslations("learner.tutor");
  const [turns, setTurns] = useState<Turn[]>(() => [
    { id: "greeting", role: "tutor", text: greeting },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const learnerTurn: Turn = {
      id: `l-${Date.now()}`,
      role: "learner",
      text: trimmed,
    };
    // priorTurnCount: how many tutor turns the BFF has already produced,
    // excluding the static greeting. Drives Socratic prompt variation.
    const priorTurnCount = turns.filter((t) => t.role === "tutor" && t.id !== "greeting").length;
    setTurns((prev) => [...prev, learnerTurn]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/tutor/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed, priorTurnCount }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { reply: { role: "tutor"; text: string }; blocked: boolean };
        error?: { message: string };
      };
      if (!res.ok || !body.ok || !body.data) {
        setError(body.error?.message ?? t("err_send"));
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}`,
          role: "tutor",
          text: body.data!.reply.text,
          blocked: body.data!.blocked,
        },
      ]);
    } catch {
      setError(t("err_network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3" aria-live="polite" aria-label={t("conversation_aria")}>
        {turns.map((turn) =>
          turn.role === "tutor" ? (
            <li key={turn.id}>
              <TutorMessage
                author="tutor"
                name="AIVO"
                avatar="✨"
                insight={
                  turn.blocked ? (
                    <TutorInsightChip kind="safety_active" />
                  ) : (
                    <TutorInsightChip kind="cited" />
                  )
                }
              >
                <p className="whitespace-pre-wrap text-base leading-relaxed">{turn.text}</p>
              </TutorMessage>
            </li>
          ) : (
            <li key={turn.id}>
              <TutorMessage author="learner" name={preferredName || t("you")} avatar="🙂">
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </TutorMessage>
            </li>
          ),
        )}
      </ol>
      <div ref={endRef} />

      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="tutor-reply" className="sr-only">
          {t("ask_label")}
        </label>
        <textarea
          id="tutor-reply"
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
          placeholder={t("input_placeholder")}
          className="w-full rounded-iw-control border border-iw-border bg-iw-bg p-3 text-sm text-iw-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? t("thinking") : t("send")}
          </Button>
        </div>
      </form>
    </div>
  );
}
