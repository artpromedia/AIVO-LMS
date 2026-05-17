import { FastifyInstance } from "fastify";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import {
  xpEvents,
  streaks,
  badges,
  virtualCurrency,
  currencyTransactions,
  leaderboardEntries,
} from "@aivo/db";
import { authenticateRequest, requireSelfOrRole } from "../auth.js";
import { xpAwardSchema, getProfileByLearnerIdSchema, streakUpdateSchema, streakFreezeSchema, badgeAwardSchema, getLeaderboardByScopeSchema, getCurrencyByLearnerIdSchema } from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`engagement-svc: ${name} must be set in production`);
  return devDefault;
}
const BRAIN_SVC_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:3002");

const XP_EVENT_TYPES = [
  "lesson_completed",
  "tutor_session_completed",
  "homework_completed",
  "quest_completed",
  "challenge_won",
  "badge_earned",
  "streak_maintained",
  "assessment_completed",
  "sel_checkin",
  "break_activity",
  "first_lesson",
  "perfect_score",
  "daily_login",
  "milestone_achieved",
] as const;

function calculateLevel(totalXp: number): number {
  let level = 1;
  while (totalXp >= level * level * 100) {
    totalXp -= level * level * 100;
    level++;
  }
  return level;
}

function xpForNextLevel(level: number): number {
  return level * level * 100;
}

function getStreakTier(streak: number): string {
  if (streak >= 30) return "gold";
  if (streak >= 14) return "purple";
  if (streak >= 7) return "orange";
  return "grey";
}

interface AwardXpBody {
  learnerId: string;
  eventType: string;
  xpAmount: number;
  coinReward?: number;
  gemReward?: number;
  metadata?: Record<string, unknown>;
}

const BADGE_RULES: { type: string; name: string; rarity: string; check: (totalXp: number, level: number, eventType: string, eventCount: number) => boolean }[] = [
  { type: "first_steps", name: "First Steps", rarity: "common", check: (_xp, _lvl, et) => et === "first_lesson" },
  { type: "rising_star", name: "Rising Star", rarity: "common", check: (xp) => xp >= 100 },
  { type: "knowledge_seeker", name: "Knowledge Seeker", rarity: "common", check: (xp) => xp >= 500 },
  { type: "level_5", name: "Level 5 Explorer", rarity: "rare", check: (_xp, lvl) => lvl >= 5 },
  { type: "level_10", name: "Level 10 Master", rarity: "epic", check: (_xp, lvl) => lvl >= 10 },
  { type: "level_20", name: "Level 20 Legend", rarity: "legendary", check: (_xp, lvl) => lvl >= 20 },
  { type: "xp_1000", name: "XP Thousandaire", rarity: "rare", check: (xp) => xp >= 1000 },
  { type: "xp_5000", name: "XP Millionaire", rarity: "epic", check: (xp) => xp >= 5000 },
  { type: "xp_10000", name: "XP Legend", rarity: "legendary", check: (xp) => xp >= 10000 },
  { type: "perfect_score", name: "Perfectionist", rarity: "rare", check: (_xp, _lvl, et) => et === "perfect_score" },
  { type: "homework_hero", name: "Homework Hero", rarity: "common", check: (_xp, _lvl, et) => et === "homework_completed" },
  { type: "quest_master", name: "Quest Master", rarity: "epic", check: (_xp, _lvl, et) => et === "quest_completed" },
  { type: "streak_7", name: "Week Warrior", rarity: "rare", check: (_xp, _lvl, et) => et === "streak_maintained" },
  { type: "challenge_champ", name: "Challenge Champion", rarity: "epic", check: (_xp, _lvl, et) => et === "challenge_won" },
];

async function notifyBrain(learnerId: string, engagement: Record<string, unknown>, authHeader: string) {
  try {
    await fetch(`${BRAIN_SVC_URL}/api/brain/${learnerId}/engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ engagement }),
    });
  } catch {
    /* brain notification is best-effort */
  }
}

export function registerXpRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>
) {
  app.post("/api/engagement/xp/award", { schema: xpAwardSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const allowedRoles = ["admin", "teacher", "service"];
    const callerRole = claims.role || "";
    const isSelf = claims.sub === (request.body as AwardXpBody).learnerId;
    if (!isSelf && !allowedRoles.includes(callerRole)) {
      return reply.status(403).send({ error: "Not authorized to award XP for this learner" });
    }

    const body = request.body as AwardXpBody;
    if (!body.learnerId || !body.eventType || !body.xpAmount) {
      return reply.status(400).send({ error: "learnerId, eventType, and xpAmount required" });
    }

    if (!XP_EVENT_TYPES.includes(body.eventType as any)) {
      return reply.status(400).send({ error: `Invalid eventType. Must be one of: ${XP_EVENT_TYPES.join(", ")}` });
    }

    if (typeof body.xpAmount !== "number" || body.xpAmount <= 0 || body.xpAmount > 1000) {
      return reply.status(400).send({ error: "xpAmount must be a positive number, max 1000" });
    }

    if (body.coinReward !== undefined && (typeof body.coinReward !== "number" || body.coinReward < 0 || body.coinReward > 500)) {
      return reply.status(400).send({ error: "coinReward must be 0-500" });
    }

    if (body.gemReward !== undefined && (typeof body.gemReward !== "number" || body.gemReward < 0 || body.gemReward > 100)) {
      return reply.status(400).send({ error: "gemReward must be 0-100" });
    }

    const tenantId = claims.tenantId || claims.sub;

    await db.insert(xpEvents).values({
      tenantId,
      learnerId: body.learnerId,
      eventType: body.eventType,
      xpAmount: body.xpAmount,
      metadata: body.metadata || {},
    });

    const [totalResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${xpEvents.xpAmount}), 0)` })
      .from(xpEvents)
      .where(eq(xpEvents.learnerId, body.learnerId));

    const totalXp = Number(totalResult.total);
    const level = calculateLevel(totalXp);

    await db
      .insert(leaderboardEntries)
      .values({
        learnerId: body.learnerId,
        scope: "global",
        totalXp,
        level,
        weeklyXp: body.xpAmount,
      })
      .onConflictDoNothing();

    await db
      .update(leaderboardEntries)
      .set({ totalXp, level, updatedAt: new Date() })
      .where(eq(leaderboardEntries.learnerId, body.learnerId));

    if (body.coinReward || body.gemReward) {
      const [existing] = await db
        .select()
        .from(virtualCurrency)
        .where(eq(virtualCurrency.learnerId, body.learnerId));

      if (existing) {
        await db
          .update(virtualCurrency)
          .set({
            coins: sql`${virtualCurrency.coins} + ${body.coinReward || 0}`,
            gems: sql`${virtualCurrency.gems} + ${body.gemReward || 0}`,
            totalCoinsEarned: sql`${virtualCurrency.totalCoinsEarned} + ${body.coinReward || 0}`,
            totalGemsEarned: sql`${virtualCurrency.totalGemsEarned} + ${body.gemReward || 0}`,
            updatedAt: new Date(),
          })
          .where(eq(virtualCurrency.learnerId, body.learnerId));
      } else {
        await db.insert(virtualCurrency).values({
          learnerId: body.learnerId,
          coins: body.coinReward || 0,
          gems: body.gemReward || 0,
          totalCoinsEarned: body.coinReward || 0,
          totalGemsEarned: body.gemReward || 0,
        });
      }

      if (body.coinReward) {
        await db.insert(currencyTransactions).values({
          learnerId: body.learnerId,
          currencyType: "coins",
          amount: body.coinReward,
          reason: body.eventType,
        });
      }
      if (body.gemReward) {
        await db.insert(currencyTransactions).values({
          learnerId: body.learnerId,
          currencyType: "gems",
          amount: body.gemReward,
          reason: body.eventType,
        });
      }
    }

    const existingBadges = await db
      .select()
      .from(badges)
      .where(eq(badges.learnerId, body.learnerId));
    const existingTypes = new Set(existingBadges.map((b) => b.badgeType));

    const [eventCountResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(xpEvents)
      .where(eq(xpEvents.learnerId, body.learnerId));
    const eventCount = Number(eventCountResult.count);

    const newBadges: string[] = [];
    for (const rule of BADGE_RULES) {
      if (existingTypes.has(rule.type)) continue;
      if (rule.check(totalXp, level, body.eventType, eventCount)) {
        await db.insert(badges).values({
          tenantId,
          learnerId: body.learnerId,
          badgeType: rule.type,
          name: rule.name,
          rarity: rule.rarity,
        });
        newBadges.push(rule.name);
      }
    }

    notifyBrain(
      body.learnerId,
      { totalXp, level, eventType: body.eventType, newBadges, streak: null },
      request.headers.authorization || ""
    );

    return {
      xpAwarded: body.xpAmount,
      totalXp,
      level,
      xpForNext: xpForNextLevel(level),
      coinsAwarded: body.coinReward || 0,
      gemsAwarded: body.gemReward || 0,
      newBadges,
    };
  });

  app.get("/api/engagement/profile/:learnerId", { schema: getProfileByLearnerIdSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as { learnerId: string };
    if (!requireSelfOrRole(claims, learnerId, "PARENT", "TEACHER", "CAREGIVER", "THERAPIST", "PLATFORM_ADMIN")) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [totalResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${xpEvents.xpAmount}), 0)` })
      .from(xpEvents)
      .where(eq(xpEvents.learnerId, learnerId));

    const totalXp = Number(totalResult.total);
    const level = calculateLevel(totalXp);

    const [streak] = await db.select().from(streaks).where(eq(streaks.learnerId, learnerId));

    const learnerBadges = await db
      .select()
      .from(badges)
      .where(eq(badges.learnerId, learnerId))
      .orderBy(desc(badges.earnedAt));

    const [currency] = await db
      .select()
      .from(virtualCurrency)
      .where(eq(virtualCurrency.learnerId, learnerId));

    const recentXp = await db
      .select()
      .from(xpEvents)
      .where(eq(xpEvents.learnerId, learnerId))
      .orderBy(desc(xpEvents.createdAt))
      .limit(20);

    return {
      learnerId,
      totalXp,
      level,
      xpForNextLevel: xpForNextLevel(level),
      xpProgress: totalXp - (level > 1 ? Array.from({ length: level - 1 }, (_, i) => (i + 1) * (i + 1) * 100).reduce((a, b) => a + b, 0) : 0),
      streak: streak
        ? {
            current: streak.currentStreak,
            longest: streak.longestStreak,
            tier: getStreakTier(streak.currentStreak || 0),
            lastActivity: streak.lastActivityDate,
            freezesUsed: streak.freezesUsed,
          }
        : { current: 0, longest: 0, tier: "grey", lastActivity: null, freezesUsed: 0 },
      badges: learnerBadges,
      currency: currency
        ? { coins: currency.coins, gems: currency.gems }
        : { coins: 0, gems: 0 },
      recentXp,
      eventTypes: XP_EVENT_TYPES,
    };
  });

  app.post("/api/engagement/streak/update", { schema: streakUpdateSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.body as { learnerId: string };
    if (!learnerId) return reply.status(400).send({ error: "learnerId required" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [existing] = await db.select().from(streaks).where(eq(streaks.learnerId, learnerId));

    if (!existing) {
      await db.insert(streaks).values({
        learnerId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
        streakTier: "grey",
      });
      return { currentStreak: 1, tier: "grey", frozen: false };
    }

    const lastDate = existing.lastActivityDate ? new Date(existing.lastActivityDate) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    const isToday = lastDate && lastDate.getTime() === today.getTime();
    if (isToday) {
      return {
        currentStreak: existing.currentStreak,
        tier: getStreakTier(existing.currentStreak || 0),
        frozen: false,
      };
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isConsecutive = lastDate && lastDate.getTime() === yesterday.getTime();

    const newStreak = isConsecutive ? (existing.currentStreak || 0) + 1 : 1;
    const newLongest = Math.max(newStreak, existing.longestStreak || 0);
    const tier = getStreakTier(newStreak);

    await db
      .update(streaks)
      .set({
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivityDate: new Date(),
        streakTier: tier,
        updatedAt: new Date(),
      })
      .where(eq(streaks.learnerId, learnerId));

    return { currentStreak: newStreak, longest: newLongest, tier, frozen: false };
  });

  app.post("/api/engagement/streak/freeze", { schema: streakFreezeSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.body as { learnerId: string };
    const [existing] = await db.select().from(streaks).where(eq(streaks.learnerId, learnerId));

    if (!existing) return reply.status(404).send({ error: "No streak found" });
    if ((existing.freezesUsed || 0) >= 2) {
      return reply.status(400).send({ error: "Maximum 2 freezes per month" });
    }

    await db
      .update(streaks)
      .set({
        freezesUsed: (existing.freezesUsed || 0) + 1,
        lastActivityDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(streaks.learnerId, learnerId));

    return { frozen: true, freezesRemaining: 2 - (existing.freezesUsed || 0) - 1 };
  });

  app.post("/api/engagement/badge/award", { schema: badgeAwardSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const body = request.body as {
      learnerId: string;
      badgeType: string;
      name: string;
      description?: string;
      rarity?: string;
    };

    const tenantId = claims.tenantId || claims.sub;

    const existing = await db
      .select()
      .from(badges)
      .where(eq(badges.learnerId, body.learnerId));

    const alreadyHas = existing.find((b) => b.badgeType === body.badgeType);
    if (alreadyHas) {
      return { alreadyEarned: true, badge: alreadyHas };
    }

    const [badge] = await db
      .insert(badges)
      .values({
        tenantId,
        learnerId: body.learnerId,
        badgeType: body.badgeType,
        name: body.name,
        description: body.description,
        rarity: body.rarity || "common",
      })
      .returning();

    return { awarded: true, badge };
  });

  // Sprint 10 (#191) — scope-aware leaderboard. The daily rollup writes one
  // row per (classroom, learner) and per (tenant, learner). Without
  // filtering by `scopeId`, a learner asking for the class leaderboard
  // sees entries from every classroom in the database mixed together.
  //
  // Contract:
  //   - "global": no scopeId required; returns the global ranking.
  //   - "class":  scopeId required; entries scoped to that classroom only.
  //   - "tenant": scopeId optional. When omitted, defaults to the caller's
  //     tenantId so a learner cannot accidentally see another tenant's
  //     leaderboard. When supplied, must match the caller's tenantId
  //     unless the caller is an admin.
  app.get("/api/engagement/leaderboard/:scope", { schema: getLeaderboardByScopeSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { scope } = request.params as { scope: string };
    const { scopeId: rawScopeId } = (request.query as { scopeId?: string }) ?? {};
    const role = (claims.role || "").toUpperCase();
    const isAdmin = role === "PLATFORM_ADMIN" || role === "DISTRICT_ADMIN" || role === "ADMIN";

    let scopeId: string | null = null;
    if (scope === "class") {
      if (!rawScopeId) {
        return reply.status(400).send({ error: "scopeId (classroom id) is required for class scope" });
      }
      scopeId = rawScopeId;
    } else if (scope === "tenant") {
      const callerTenantId = claims.tenantId ?? null;
      if (rawScopeId) {
        if (!isAdmin && rawScopeId !== callerTenantId) {
          return reply.status(403).send({ error: "Cannot read leaderboard for a different tenant" });
        }
        scopeId = rawScopeId;
      } else if (callerTenantId) {
        scopeId = callerTenantId;
      } else {
        return reply.status(400).send({ error: "scopeId is required for tenant scope when caller has no tenant" });
      }
    } else if (scope === "global") {
      // Global is unscoped; ignore any scopeId the caller passed.
      scopeId = null;
    } else {
      return reply.status(400).send({ error: `Unknown scope: ${scope}` });
    }

    const where =
      scopeId === null
        ? and(eq(leaderboardEntries.scope, scope), isNull(leaderboardEntries.scopeId))
        : and(eq(leaderboardEntries.scope, scope), eq(leaderboardEntries.scopeId, scopeId));

    const entries = await db
      .select()
      .from(leaderboardEntries)
      .where(where)
      .orderBy(desc(leaderboardEntries.totalXp))
      .limit(50);

    return entries;
  });

  app.get("/api/engagement/currency/:learnerId", { schema: getCurrencyByLearnerIdSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as { learnerId: string };
    if (!requireSelfOrRole(claims, learnerId, "PARENT", "TEACHER", "PLATFORM_ADMIN")) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [currency] = await db
      .select()
      .from(virtualCurrency)
      .where(eq(virtualCurrency.learnerId, learnerId));

    const transactions = await db
      .select()
      .from(currencyTransactions)
      .where(eq(currencyTransactions.learnerId, learnerId))
      .orderBy(desc(currencyTransactions.createdAt))
      .limit(50);

    return {
      balance: currency ? { coins: currency.coins, gems: currency.gems } : { coins: 0, gems: 0 },
      transactions,
    };
  });
}
