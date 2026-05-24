/**
 * Sprint 5 (learner roadmap): shared engagement contract.
 *
 * The mobile app, the web BFF, and (eventually) the engagement-svc all
 * exchange the same `EngagementProfile` shape. This file is the single
 * source of truth so neither surface can drift. The mobile app re-exports
 * these types from `apps/mobile/src/contracts/engagement.ts`; both files
 * must stay byte-identical (a CI check or simple lint can enforce this
 * later — for now the equivalence is documented).
 *
 * Field semantics:
 *  - `userId` is the learner's stable id (matches `LearnerProfile.id`).
 *  - `xp` is the learner's lifetime XP total.
 *  - `level` is derived from XP by the engagement service; clients render
 *     it as-is and do not recompute.
 *  - `coins` are spendable in the shop; `gems` are a premium currency.
 *  - `streakDays` is the *current* daily-practice streak (0 when broken
 *     and not yet rebuilt today). `streakFrozen` is true when the learner
 *     has applied a streak freeze for the current period.
 *  - `badges` lists already-earned badges, newest first.
 *  - `activeChallenges` lists challenges the learner currently has open.
 *     `progress`/`target` are integers so clients can render a fraction
 *     without floating-point surprises.
 */
export interface EngagementProfile {
  readonly userId: string;
  readonly xp: number;
  readonly level: number;
  readonly coins: number;
  readonly gems: number;
  readonly streakDays: number;
  readonly streakFrozen: boolean;
  readonly badges: readonly EngagementBadge[];
  readonly activeChallenges: readonly EngagementChallenge[];
}

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export interface EngagementBadge {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly rarity: BadgeRarity;
  /** ISO-8601 timestamp. */
  readonly earnedAt: string;
}

export type ChallengeType = "daily" | "weekly" | "multiplayer";

export interface EngagementChallenge {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: ChallengeType;
  readonly progress: number;
  readonly target: number;
  readonly reward: { readonly xp: number; readonly coins: number };
}
