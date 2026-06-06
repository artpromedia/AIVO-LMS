"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PATTERN_DEFAULT_LENGTH,
  PATTERN_TILE_COUNT,
  generatePatternSequence,
  isPatternGuessCorrect,
} from "@/lib/learner/calm";

/** Calm, distinct tones per tile — never the only signal: each tile also
 *  carries a number label so it is operable without colour perception. */
const TILE_TONES = [
  "bg-aivo-primary/30",
  "bg-aivo-accent/30",
  "bg-aivo-success/30",
  "bg-aivo-warning/30",
] as const;

/** Milliseconds each tile stays highlighted during the watch phase. */
const REVEAL_MS = 800;

type Phase = "watch" | "input";
type Feedback = "none" | "wrong" | "correct";

/**
 * Pattern Focus — a low-stakes "watch then repeat" grounding activity.
 * No score, no timer pressure, no lose state: an incorrect tap gently
 * re-prompts. Honours prefers-reduced-motion by replacing the animated
 * reveal with a static, readable sequence the learner can take in calmly.
 */
export function PatternFocus({
  onDone,
  onCancel,
}: {
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("learner.calm.games");
  const startedAt = useRef<number>(Date.now());
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sequence] = useState<number[]>(() =>
    generatePatternSequence(Math.random, PATTERN_DEFAULT_LENGTH),
  );
  const [phase, setPhase] = useState<Phase>("watch");
  const [revealIdx, setRevealIdx] = useState(0);
  const [guess, setGuess] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>("none");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Animated reveal only when motion is allowed; reduced-motion learners
  // read the static sequence and start when they're ready.
  useEffect(() => {
    if (phase !== "watch" || reducedMotion) return;
    if (revealIdx >= sequence.length) {
      const id = setTimeout(() => setPhase("input"), REVEAL_MS / 2);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setRevealIdx((i) => i + 1), REVEAL_MS);
    return () => clearTimeout(id);
  }, [phase, reducedMotion, revealIdx, sequence.length]);

  const restartWatch = useCallback(() => {
    setGuess([]);
    setFeedback("none");
    setRevealIdx(0);
    setPhase("watch");
  }, []);

  const tapTile = useCallback(
    (tile: number) => {
      if (phase !== "input" || feedback === "correct") return;
      const next = [...guess, tile];
      setGuess(next);
      if (next.length < sequence.length) {
        setFeedback("none");
        return;
      }
      if (isPatternGuessCorrect(sequence, next)) {
        setFeedback("correct");
        const secs = Math.round((Date.now() - startedAt.current) / 1000);
        // Brief, gentle pause on the success message, then complete.
        window.setTimeout(() => onDone(secs), 900);
      } else {
        // No lose state — clear the attempt and invite another calm try.
        setFeedback("wrong");
        setGuess([]);
      }
    },
    [phase, feedback, guess, sequence, onDone],
  );

  const highlighted =
    phase === "watch" && !reducedMotion && revealIdx < sequence.length
      ? sequence[revealIdx]
      : null;

  const statusText =
    feedback === "correct"
      ? t("nice")
      : feedback === "wrong"
        ? t("try_again")
        : phase === "watch"
          ? t("pattern_watch")
          : t("pattern_repeat");

  return (
    <Card className="mt-6 flex flex-col items-center gap-5 p-6 text-center">
      <h2 className="font-display text-2xl font-bold">{t("pattern_title")}</h2>

      {phase === "watch" && reducedMotion ? (
        <p className="text-aivo-ink-soft">
          {t("pattern_sequence", { sequence: sequence.map((n) => n + 1).join(" · ") })}
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="min-h-[1.5rem] font-medium">
        {statusText}
      </p>

      <div className="grid grid-cols-2 gap-3" role="group" aria-label={t("pattern_board_aria")}>
        {Array.from({ length: PATTERN_TILE_COUNT }, (_, tile) => {
          const isLit = highlighted === tile;
          return (
            <button
              key={tile}
              type="button"
              disabled={phase !== "input" || feedback === "correct"}
              onClick={() => tapTile(tile)}
              aria-label={t("pattern_tile", { number: tile + 1 })}
              className={
                "h-20 w-20 rounded-iw-card-lg border text-xl font-semibold text-iw-text-strong " +
                "focus:outline-none focus:ring-2 focus:ring-aivo-primary focus:ring-offset-2 " +
                "disabled:opacity-60 " +
                (reducedMotion ? "" : "transition-transform duration-300 ") +
                TILE_TONES[tile] +
                (isLit ? " scale-105 border-aivo-primary" : " border-iw-border")
              }
            >
              {tile + 1}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {phase === "input" && feedback !== "correct" ? (
          <Button variant="outline" onClick={restartWatch}>
            {t("watch_again")}
          </Button>
        ) : null}
        <Button onClick={() => onDone(Math.round((Date.now() - startedAt.current) / 1000))}>
          {t("done")}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t("go_back")}
        </Button>
      </div>
    </Card>
  );
}
