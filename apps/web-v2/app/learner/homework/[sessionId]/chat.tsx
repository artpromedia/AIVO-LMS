"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SurfaceRouter, type SurfaceRouterItem } from "@aivo/learner-surfaces";
import { useTTS, useSpeechInput, DEFAULT_SENSORY_ADAPTATIONS } from "@aivo/stage-runtime";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NovaCharacter } from "@/components/learner/art/tutor-character";
import type { HomeworkHelpMessage } from "@/lib/db/types";
import { observeFocus, type FocusObservation } from "@/lib/homework/focus";

/** How often we re-evaluate focus from local signals (drives inactivity). */
const FOCUS_POLL_MS = 15_000;
/** Two sends closer together than this count as a rapid resend. */
const RAPID_RESEND_MS = 12_000;
/** After a dismiss, suppress re-tripping for this long. */
const NUDGE_COOLDOWN_MS = 120_000;

/** Map a stored homework surface onto a SurfaceRouter item. */
function toSurfaceItem(message: HomeworkHelpMessage): SurfaceRouterItem | null {
  const s = message.surface;
  if (!s) return null;
  return {
    id: message.id,
    surfaceType: s.surfaceType,
    prompt: s.prompt,
    instructions: s.instructions,
    numberLine: s.numberLine,
    expectedAnswer: s.expectedAnswer,
    // The number line carries its own "place a dot" + submit affordance, so we
    // suppress the router's default text answer box.
    answerInput: { type: "none" },
  };
}

export function HomeworkChat({
  learnerId,
  sessionId,
  initialMessages,
  regulationEnabled = false,
  onRequestBreak,
  onProgress,
}: {
  learnerId: string;
  sessionId: string;
  initialMessages: HomeworkHelpMessage[];
  regulationEnabled?: boolean;
  onRequestBreak?: () => void;
  onProgress?: (learnerTurns: number) => void;
}) {
  const router = useRouter();
  const t = useTranslations("learner.homework");
  const locale = useLocale();
  const [messages, setMessages] = useState<HomeworkHelpMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answeredSurfaces, setAnsweredSurfaces] = useState<Set<string>>(new Set());
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Per-turn read-aloud — a single browser TTS voice for the homework helper.
  const tts = useTTS("nova", DEFAULT_SENSORY_ADAPTATIONS, locale);
  // Hands-free voice input — transcript flows into the composer; the learner
  // still reviews/sends, so a mis-hear never auto-posts.
  const speech = useSpeechInput({
    locale,
    onResult: (transcript) => {
      setText((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript));
      markActivity();
    },
  });

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
    onProgress?.(messages.filter((m) => m.role === "learner").length);
  }, [messages, onProgress]);

  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;

  const sendText = useCallback(
    async (raw: string) => {
      setError(null);
      const trimmed = raw.trim();
      if (!trimmed || busyRef.current) return false;
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
          return false;
        }
        setMessages(body.data.session.messages);
        setText("");
        return true;
      } catch {
        setError(t("err_network"));
        return false;
      } finally {
        setBusy(false);
        // Re-evaluate once the send has fully settled (never mid-flight).
        if (regulationEnabled) window.setTimeout(evaluateFocus, 0);
      }
    },
    [learnerId, sessionId, t, markActivity, regulationEnabled, evaluateFocus],
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await sendText(text);
  }

  const readAloud = useCallback(
    (message: HomeworkHelpMessage) => {
      if (speakingId === message.id) {
        tts.stop();
        setSpeakingId(null);
        return;
      }
      tts.stop();
      setSpeakingId(message.id);
      void tts.speak(message.text).finally(() => {
        setSpeakingId((current) => (current === message.id ? null : current));
      });
    },
    [tts, speakingId],
  );

  const onSurfaceSubmit = useCallback(
    async (message: HomeworkHelpMessage, value: string) => {
      // Lock the number line only once the answer has actually posted — a
      // failed send (network/safety) must leave it interactable for a retry.
      const sent = await sendText(t("surface_answer", { value }));
      if (sent) setAnsweredSurfaces((prev) => new Set(prev).add(message.id));
    },
    [sendText, t],
  );

  const listening = speech.status === "listening" || speech.status === "processing";

  const chips = useMemo(
    () => [
      { key: "unsure", label: t("chip_unsure"), action: () => void sendText(t("chip_unsure")) },
      { key: "explain", label: t("chip_explain"), action: () => void sendText(t("chip_explain")) },
      { key: "try", label: t("chip_try"), action: () => void sendText(t("chip_try")) },
      {
        key: "break",
        label: t("chip_break"),
        action: () => (onRequestBreak ? onRequestBreak() : void sendText(t("chip_break"))),
      },
    ],
    [t, sendText, onRequestBreak],
  );

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <ol className="grid gap-4" aria-live="polite" aria-label={t("conversation_aria")}>
          {messages.map((m) => {
            const item = m.role === "tutor" ? toSurfaceItem(m) : null;
            const surfaceDisabled = answeredSurfaces.has(m.id) || m.id !== lastMessageId;
            return (
              <li key={m.id} className="grid gap-2">
                <div className={`flex ${m.role === "learner" ? "justify-end" : "justify-start"}`}>
                  {m.role === "tutor" ? (
                    <div className="flex max-w-[85%] items-start gap-2">
                      <NovaCharacter size={36} className="mt-0.5 shrink-0" />
                      <div className="rounded-2xl rounded-tl-sm bg-iw-accent-soft px-4 py-2.5 text-sm text-iw-ink">
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <button
                          type="button"
                          onClick={() => readAloud(m)}
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-iw-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-primary rounded"
                          aria-pressed={speakingId === m.id}
                        >
                          <span aria-hidden="true">{speakingId === m.id ? "■" : "▶"}</span>
                          {speakingId === m.id ? t("stop_aloud") : t("read_aloud")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-iw-primary px-4 py-2.5 text-sm text-white">
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  )}
                </div>
                {item ? (
                  <div className="ml-10 rounded-2xl border border-iw-border bg-iw-surface p-3">
                    <SurfaceRouter
                      item={item}
                      disabled={surfaceDisabled || busy}
                      onSubmitAndAdvance={({ response }) => {
                        const value =
                          typeof response.answer === "string"
                            ? response.answer
                            : response.answer == null
                              ? ""
                              : String(response.answer);
                        if (value) void onSurfaceSubmit(m, value);
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div ref={endRef} />
      </Card>

      {/* Quick replies — gentle, tappable ways to respond without typing. */}
      <div className="flex flex-wrap gap-2" aria-label={t("chips_aria")}>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.action}
            disabled={busy}
            className="rounded-full border border-iw-border bg-iw-surface px-4 py-2 text-sm font-medium text-iw-ink transition-colors hover:bg-iw-accent-soft disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-primary"
          >
            {chip.label}
          </button>
        ))}
      </div>

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
        <div className="flex items-end gap-2">
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
            className="min-h-[52px] w-full rounded-2xl border border-input bg-background p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {speech.isSupported ? (
            <button
              type="button"
              onClick={() => (listening ? speech.stop() : void speech.start())}
              aria-pressed={listening}
              aria-label={listening ? t("voice_stop") : t("voice_start")}
              title={listening ? t("voice_stop") : t("voice_start")}
              className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border text-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-primary ${
                listening
                  ? "border-iw-primary bg-iw-primary text-white animate-pulse"
                  : "border-iw-border bg-iw-surface text-iw-ink hover:bg-iw-accent-soft"
              }`}
            >
              <span aria-hidden="true">🎤</span>
            </button>
          ) : null}
        </div>
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
}
