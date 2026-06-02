import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getLearnerEngagement, listLearnerBadges } from "@/lib/db/repos";
import type { BadgeKey } from "@/lib/db/types";
import type { BadgeRarity, EngagementBadge, EngagementProfile } from "@/lib/contracts/engagement";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * Catalog metadata for each `BadgeKey`. Mirrors the parent milestones
 * page (`apps/web-v2/app/parent/learners/[learnerId]/milestones/page.tsx`)
 * but emits emoji icons + a rarity tier so the shared
 * `EngagementProfile` contract can be filled in without pulling Lucide
 * icon components into a serializable response. Keep the keys in sync
 * with `BadgeKey` in `lib/db/types.ts`.
 */
const BADGE_CATALOG: Record<
  BadgeKey,
  {
    name: string;
    description: string;
    icon: string;
    rarity: BadgeRarity;
  }
> = {
  first_session: {
    name: "First Session",
    description: "Complete the first tutoring session.",
    icon: "⭐",
    rarity: "common",
  },
  on_fire: {
    name: "On Fire",
    description: "Maintain a 7-day learning streak.",
    icon: "🔥",
    rarity: "rare",
  },
  brain_activated: {
    name: "Brain Activated",
    description: "Brain profile reviewed and approved.",
    icon: "🧠",
    rarity: "common",
  },
  bookworm: {
    name: "Bookworm",
    description: "Ten sessions completed.",
    icon: "📚",
    rarity: "rare",
  },
  mastery_champion: {
    name: "Mastery Champion",
    description: "Any subject above 75% mastery.",
    icon: "🏆",
    rarity: "epic",
  },
  goal_getter: {
    name: "Goal Getter",
    description: "IEP goal met for the period.",
    icon: "🎯",
    rarity: "epic",
  },
  team_player: {
    name: "Team Player",
    description: "Full care team active and collaborating.",
    icon: "🤝",
    rarity: "rare",
  },
  multi_subject: {
    name: "Multi-Subject",
    description: "Active in three or more subjects.",
    icon: "🌈",
    rarity: "rare",
  },
  speed_learner: {
    name: "Speed Learner",
    description: "Session time in top 25% of cohort.",
    icon: "⚡",
    rarity: "epic",
  },
  explorer: {
    name: "Explorer",
    description: "Every subject area explored.",
    icon: "🌍",
    rarity: "legendary",
  },
};

/**
 * GET /api/bff/learners/[learnerId]/engagement
 *
 * Sprint 5 (learner roadmap): returns the shared `EngagementProfile`
 * shape that the mobile app already speaks. The repo stores
 * `LearnerEngagement` with web-flavoured field names (`totalXp`,
 * `currentStreakDays`); this route maps to the cross-surface contract
 * so both web and mobile clients can render from the same payload.
 *
 * `streakFrozen` and `activeChallenges` are not yet modelled in the
 * web mock repo, so the response reports `false` / `[]` respectively.
 * The contract intentionally keeps those fields so adding them later
 * is purely additive on the server.
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    // Sprint 10 — engagement exposes personalised gamification data
    // (XP, streaks, earned badges). consent:audit now classifies this
    // route as `required: true`; without the gate it would fail CI.
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const eng = getLearnerEngagement(learnerId, session!.tenantId);
    const earned = listLearnerBadges(learnerId, session!.tenantId);
    const badges: EngagementBadge[] = earned.map((b) => {
      const meta = BADGE_CATALOG[b.badgeKey];
      return {
        id: b.id,
        name: meta.name,
        description: meta.description,
        icon: meta.icon,
        rarity: meta.rarity,
        earnedAt: b.earnedAt,
      };
    });
    const profile: EngagementProfile = {
      userId: learnerId,
      xp: eng?.totalXp ?? 0,
      level: eng?.level ?? 1,
      coins: eng?.coins ?? 0,
      gems: eng?.gems ?? 0,
      streakDays: eng?.currentStreakDays ?? 0,
      streakFrozen: false,
      badges,
      activeChallenges: [],
    };
    return ok(profile, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
