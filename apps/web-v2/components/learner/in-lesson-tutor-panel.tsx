"use client";

/**
 * Wave E (S9) — the in-lesson tutor panel.
 *
 * Renders the agent tutor's presence inside the lesson player: who is
 * watching (brand tutor identity), a calm one-line message when the agent
 * says something or attaches encouragement, a break OFFER (always the
 * learner's choice — never auto-paused), and the kind wind-down CTA when
 * the agent ends a session early.
 *
 * Mounted ONLY when agentic mode is on for the lesson — with the flag off
 * this component never renders, keeping the player byte-identical.
 *
 * a11y: the message region is aria-live=polite so read-aloud announces
 * tutor messages without stealing focus; buttons are plain <Button>s so
 * AAC scan targets pick them up like every other control.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export interface InLessonTutorIdentity {
  tutorKey: string;
  name: string;
  icon: string;
  color: string;
}

export interface InLessonTutorPanelProps {
  tutor: InLessonTutorIdentity;
  /** Latest learner-visible agent message (already quality-gated server-side). */
  message: string | null;
  thinking: boolean;
  breakOffer: { durationSeconds: number } | null;
  onAcceptBreak: () => void;
  onDeclineBreak: () => void;
  /** Present when the agent proposed ending early; CTA finishes the lesson. */
  endEarly: { reason: string } | null;
  onFinishEarly: () => void;
  reducedMotion: boolean;
}

export function InLessonTutorPanel({
  tutor,
  message,
  thinking,
  breakOffer,
  onAcceptBreak,
  onDeclineBreak,
  endEarly,
  onFinishEarly,
  reducedMotion,
}: InLessonTutorPanelProps) {
  const t = useTranslations("learner.lesson_player");
  const hasContent = Boolean(message) || thinking || Boolean(breakOffer) || Boolean(endEarly);

  return (
    <section
      data-testid="in-lesson-tutor-panel"
      aria-label={t("tutor_panel_label", { name: tutor.name })}
      className="mb-4 rounded-lg border border-aivo-border bg-aivo-surface p-3"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `${tutor.color}1A`, color: tutor.color }}
        >
          {tutor.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-aivo-ink-soft">
            {t("tutor_panel_watching", { name: tutor.name })}
          </p>
          <div aria-live="polite">
            {thinking ? (
              <p
                data-testid="tutor-panel-thinking"
                className={`mt-1 text-sm text-aivo-ink-soft ${reducedMotion ? "" : "animate-pulse"}`}
              >
                {t("tutor_panel_thinking")}
              </p>
            ) : message ? (
              <p data-testid="tutor-panel-message" className="mt-1 text-sm text-aivo-ink">
                {message}
              </p>
            ) : !hasContent ? (
              <p className="mt-1 text-sm text-aivo-ink-soft">{t("tutor_panel_idle")}</p>
            ) : null}
          </div>

          {breakOffer ? (
            <div
              data-testid="tutor-panel-break-offer"
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <p className="text-sm text-aivo-ink">{t("tutor_panel_break_offer")}</p>
              <Button size="sm" onClick={onAcceptBreak}>
                {t("tutor_panel_break_yes")}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDeclineBreak}>
                {t("tutor_panel_break_no")}
              </Button>
            </div>
          ) : null}

          {endEarly ? (
            <div
              data-testid="tutor-panel-end-early"
              className="mt-2 flex flex-wrap items-center gap-2"
            >
              <p className="text-sm text-aivo-ink">{t("tutor_panel_end_early")}</p>
              <Button size="sm" onClick={onFinishEarly}>
                {t("tutor_panel_finish_now")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
