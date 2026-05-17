/**
 * Speech Buddy gamification primitives (interface-only scaffold).
 *
 * The skill-graph + research telemetry task implements bodies; this scaffold
 * exists so other tasks can import a stable surface today.
 *
 * See: docs/products/speech-buddy/README.md (session format + skill map)
 */

import type { AgeBand, SkillTag } from "@aivo/events";

export interface FriendshipToken {
  skill: SkillTag;
  /** Number of tokens of this skill the learner has collected. */
  count: number;
}

export interface SpeechBuddyStreak {
  /** Consecutive days with at least one completed session. */
  currentDays: number;
  longestDays: number;
  lastSessionAt?: string;
}

export interface WeeklyQuest {
  id: string;
  /** Localised, child-readable title. */
  title: string;
  skill: SkillTag;
  /** Sessions or evidence count required to complete. */
  goal: number;
  progress: number;
  expiresAt: string;
}

export interface DailyCapPolicy {
  /** Server-enforced cap on completed sessions per UTC day, per age band. */
  cap: number;
}

/**
 * Default server-side daily caps. Per-tenant overrides will be added in the
 * skill-graph task. Values match docs/products/speech-buddy/README.md.
 */
export const DEFAULT_DAILY_CAPS: Readonly<Record<AgeBand, DailyCapPolicy>> = {
  "6-9": { cap: 1 },
  "10-12": { cap: 2 },
  "13-15": { cap: 3 },
} as const;

export type GrantFriendshipToken = (
  learnerId: string,
  skill: SkillTag,
  amount?: number,
) => Promise<FriendshipToken>;

export type GetSpeechBuddyStreak = (
  learnerId: string,
) => Promise<SpeechBuddyStreak>;

export type ListActiveWeeklyQuests = (
  learnerId: string,
) => Promise<WeeklyQuest[]>;
