/**
 * Remediation Sprint 12 — REAL engagement: lesson completion awards XP and
 * advances the streak.
 *
 * The audit found XP/level/streak were seed-frozen ("nothing ever writes
 * it"). This module is the single write path: `completeLessonRun` calls
 * `awardLessonEngagement` exactly once per completed run (the repo's
 * idempotent already-completed guard prevents double-award), and the
 * learner home's existing `getLearnerEngagement` read shows live values.
 *
 * Rules (deterministic, outcome-derived — never client-trusted):
 *   XP   = 20 base participation
 *        + 10 × checks answered correctly
 *        + 15 independence bonus (no hints AND no scaffolds, ≥1 check)
 *        (abandoned runs earn the base only — showing up still counts)
 *   Level = 1 + floor(totalXp / 250)
 *   Streak: first active day +1 (longest tracks it); same UTC day no
 *   change; a gap of more than one day resets to 1.
 */
import { getPersistence } from "@/lib/db/persistence";
import type { LearnerEngagement, LessonOutcome } from "@/lib/db/types";

export const XP_BASE = 20;
export const XP_PER_CORRECT_CHECK = 10;
export const XP_INDEPENDENCE_BONUS = 15;
export const XP_PER_LEVEL = 250;

export function xpForOutcome(outcome: LessonOutcome): number {
  if (outcome.abandoned) return XP_BASE;
  const independent =
    outcome.checksTotal > 0 && outcome.hintsUsed === 0 && outcome.scaffoldsUsed === 0;
  return (
    XP_BASE + outcome.checksCorrect * XP_PER_CORRECT_CHECK + (independent ? XP_INDEPENDENCE_BONUS : 0)
  );
}

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

function dayDistance(fromIso: string, toIso: string): number {
  const from = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((to - from) / 86_400_000);
}

/** Pure streak transition — exported for tests. */
export function nextStreak(
  current: { currentStreakDays: number; lastSessionAt: string | null },
  completedAt: string,
): number {
  // First tracked session: the streak starts (seeded display values are
  // preserved rather than incremented — we never invent history).
  if (!current.lastSessionAt) return Math.max(1, current.currentStreakDays);
  const gap = dayDistance(utcDay(current.lastSessionAt), utcDay(completedAt));
  if (gap <= 0) return Math.max(1, current.currentStreakDays); // same day — no double count
  if (gap === 1) return current.currentStreakDays + 1; // consecutive day
  return 1; // missed a day — streak restarts
}

export async function awardLessonEngagement(input: {
  learnerId: string;
  tenantId: string;
  outcome: LessonOutcome;
  completedAt: string;
}): Promise<LearnerEngagement> {
  const persistence = getPersistence();
  const existing = await persistence.engagement.getEngagement(input.learnerId);
  const base: LearnerEngagement = existing ?? {
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    totalXp: 0,
    level: 1,
    currentStreakDays: 0,
    longestStreakDays: 0,
    coins: 0,
    gems: 0,
    lastSessionAt: null,
    updatedAt: input.completedAt,
  };
  const earned = xpForOutcome(input.outcome);
  const totalXp = base.totalXp + earned;
  const streak = nextStreak(
    { currentStreakDays: base.currentStreakDays, lastSessionAt: base.lastSessionAt },
    input.completedAt,
  );
  const updated: LearnerEngagement = {
    ...base,
    totalXp,
    level: 1 + Math.floor(totalXp / XP_PER_LEVEL),
    currentStreakDays: streak,
    longestStreakDays: Math.max(base.longestStreakDays, streak),
    coins: base.coins + Math.floor(earned / 10),
    lastSessionAt: input.completedAt,
    updatedAt: input.completedAt,
  };
  return persistence.engagement.upsertEngagement(updated);
}
