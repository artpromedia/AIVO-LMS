/**
 * Scaffolding strategy — escalates support after consecutive incorrect or
 * slow responses. The runtime can use the returned decision to surface a
 * hint, simplify a distractor, or hand off to a peer-modeling video.
 *
 *   0 incorrect     → "none"
 *   1 incorrect     → "hint"          (verbal nudge)
 *   2 incorrect     → "model"         (worked example / video)
 *   3+ incorrect    → "simplify"      (transform down a functioning level)
 */
import type { AnswerOutcome } from "../types.js";

export type ScaffoldLevel = "none" | "hint" | "model" | "simplify";

export interface ScaffoldInput {
  /** Outcomes for the current skill, oldest first. */
  recent: AnswerOutcome[];
  /** Current scaffold level (so we don't oscillate). */
  current?: ScaffoldLevel;
}

export interface ScaffoldDecision {
  level: ScaffoldLevel;
  /** Human-readable reason — surfaced in dev tools / replay. */
  rationale: string;
}

const ORDER: ScaffoldLevel[] = ["none", "hint", "model", "simplify"];

export function scaffold(input: ScaffoldInput): ScaffoldDecision {
  const tail = input.recent.slice(-3);
  // Count consecutive incorrects from the tail backwards.
  let consecutiveWrong = 0;
  for (let i = tail.length - 1; i >= 0; i--) {
    if (!tail[i].correct) consecutiveWrong++;
    else break;
  }

  // If the latest answer was correct, ratchet the scaffold *down* one
  // step so support fades as the learner recovers.
  if (consecutiveWrong === 0 && tail.length > 0) {
    const cur = input.current ?? "none";
    const idx = Math.max(0, ORDER.indexOf(cur) - 1);
    return {
      level: ORDER[idx],
      rationale: "Most recent answer was correct — fade scaffold one step.",
    };
  }

  if (consecutiveWrong >= 3) {
    return {
      level: "simplify",
      rationale: "3+ consecutive incorrects — transform activity down a level.",
    };
  }
  if (consecutiveWrong === 2) {
    return { level: "model", rationale: "2 consecutive incorrects — show worked example." };
  }
  if (consecutiveWrong === 1) {
    return { level: "hint", rationale: "1 incorrect — surface a hint." };
  }
  return { level: "none", rationale: "No incorrect responses yet." };
}
