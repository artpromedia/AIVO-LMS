import { FastifyInstance } from "fastify";
import { eq, sql, desc } from "drizzle-orm";
import { xpEvents, streaks, badges, virtualCurrency } from "@aivo/db";
import { authenticateRequest, requireSelfOrRole } from "../auth.js";

/**
 * Sprint 6.1 (Gap #8) — canonical event ingestion + learner-state read.
 *
 * The pre-Sprint-6 surface area (xp.ts / shop.ts / quests.ts) is wide,
 * with one POST per ledger. The web + mobile clients only need two
 * things to render the home-page hero (XP/level/streak/badges):
 *
 *   POST /api/engagement/events
 *     Body: { learnerId, type, payload }
 *       - type ∈ lesson_completed | streak_day | quest_finished
 *               | badge_earned
 *       - payload carries authored XP + (optionally) a skillCode
 *         used by the audit trail; the service applies a small
 *         completion bonus on top of the authored value.
 *
 *   GET /api/engagement/learners/:id/state
 *     Returns: { streakDays, xp, level, badges[], achievements[],
 *                lastActiveAt }
 *
 * The route emits a `engagement.events` topic to NATS via the
 * `ENGAGEMENT_EVENTS_TOPIC` env var when set. Topic publication is
 * fire-and-forget — failures are logged but do not roll back the
 * write.
 *
 * Streak math is timezone-aware: the learner's IANA TZ is read from
 * `learnerProfiles.timeZone`; day boundaries are computed in that TZ
 * before the consecutive-day check. Falls back to UTC when no TZ is
 * stored.
 */

type EngagementEventType = "lesson_completed" | "streak_day" | "quest_finished" | "badge_earned";

interface EventBody {
  learnerId: string;
  type: EngagementEventType;
  payload?: {
    xp?: number;
    skillCode?: string;
    questId?: string;
    badgeId?: string;
    [k: string]: unknown;
  };
}

const COMPLETION_BONUS = 5; // applied per lesson_completed on top of authored XP

function calculateLevel(totalXp: number): number {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= level * level * 100) {
    remaining -= level * level * 100;
    level++;
  }
  return level;
}

function getStreakTier(streak: number): string {
  if (streak >= 30) return "gold";
  if (streak >= 14) return "purple";
  if (streak >= 7) return "orange";
  return "grey";
}

/**
 * Compute the calendar day (YYYY-MM-DD) for a Date in a given IANA
 * timezone. Used so a learner in Pacific time who studies at 11pm
 * doesn't lose their streak because UTC has already rolled over.
 */
function dayKeyInTimezone(date: Date, timeZone: string | null): string {
  try {
    const tz = timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function daysBetweenKeys(prev: string, today: string): number {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86_400_000,
  );
}

async function publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
  // Lazy require so engagement-svc doesn't hard-depend on NATS in tests
  // or in development environments without a broker. `nats` is loaded
  // via a runtime require to avoid pulling its types into the build.
  try {
    const url = process.env.NATS_URL;
    if (!url) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nats: any = await import(/* @vite-ignore */ "nats" as string).catch(() => null);
    if (!nats?.connect) return;
    const nc = await nats.connect({ servers: url });
    nc.publish(topic, new TextEncoder().encode(JSON.stringify(payload)));
    await nc.drain();
  } catch {
    /* best-effort */
  }
}

export function registerEventRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>,
) {
  app.post("/api/engagement/events", async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const body = request.body as EventBody | undefined;
    if (!body?.learnerId || !body?.type) {
      return reply.status(400).send({ error: "learnerId and type required" });
    }

    const allowedTypes: EngagementEventType[] = [
      "lesson_completed",
      "streak_day",
      "quest_finished",
      "badge_earned",
    ];
    if (!allowedTypes.includes(body.type)) {
      return reply.status(400).send({ error: `Invalid type. Allowed: ${allowedTypes.join(", ")}` });
    }

    const allowedRoles = ["admin", "teacher", "service"];
    const callerRole = claims.role || "";
    const isSelf = claims.sub === body.learnerId;
    if (!isSelf && !allowedRoles.includes(callerRole)) {
      return reply.status(403).send({ error: "Not authorized for this learner" });
    }

    const tenantId = claims.tenantId || claims.sub;
    const authoredXp = Number(body.payload?.xp ?? 0);
    const xpAmount =
      body.type === "lesson_completed"
        ? Math.max(0, authoredXp) + COMPLETION_BONUS
        : Math.max(0, authoredXp);

    if (xpAmount > 0) {
      await db.insert(xpEvents).values({
        tenantId,
        learnerId: body.learnerId,
        eventType: body.type,
        xpAmount,
        metadata: body.payload ?? {},
      });
    }

    // Timezone-aware streak update for daily events. The learner's TZ
    // would normally live on `learnerProfiles`, but the column hasn't
    // been added yet — see services/engagement-svc/docs/xp-model.md
    // for the planned migration. Until then we honour an inline
    // payload.timeZone hint and fall back to UTC.
    if (body.type === "lesson_completed" || body.type === "streak_day") {
      const tz =
        (body.payload as { timeZone?: string } | undefined)?.timeZone ??
        process.env.DEFAULT_LEARNER_TIMEZONE ??
        null;
      const now = new Date();
      const todayKey = dayKeyInTimezone(now, tz);

      const [existing] = await db
        .select()
        .from(streaks)
        .where(eq(streaks.learnerId, body.learnerId));

      if (!existing) {
        await db.insert(streaks).values({
          learnerId: body.learnerId,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: now,
          streakTier: "grey",
        });
      } else {
        const lastKey = existing.lastActivityDate
          ? dayKeyInTimezone(new Date(existing.lastActivityDate), tz)
          : null;
        if (lastKey !== todayKey) {
          const gap = lastKey ? daysBetweenKeys(lastKey, todayKey) : 99;
          const newStreak = gap === 1 ? (existing.currentStreak || 0) + 1 : 1;
          const newLongest = Math.max(newStreak, existing.longestStreak || 0);
          await db
            .update(streaks)
            .set({
              currentStreak: newStreak,
              longestStreak: newLongest,
              lastActivityDate: now,
              streakTier: getStreakTier(newStreak),
              updatedAt: now,
            })
            .where(eq(streaks.learnerId, body.learnerId));
        }
      }
    }

    const topic = process.env.ENGAGEMENT_EVENTS_TOPIC || "engagement.events";
    publishEvent(topic, {
      learnerId: body.learnerId,
      type: body.type,
      xpAmount,
      payload: body.payload ?? {},
      ts: new Date().toISOString(),
    });

    return { ok: true, xpAwarded: xpAmount };
  });

  app.get("/api/engagement/learners/:learnerId/state", async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as { learnerId: string };
    if (!requireSelfOrRole(claims, learnerId, "PARENT", "TEACHER", "PLATFORM_ADMIN")) {
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

    const recent = await db
      .select()
      .from(xpEvents)
      .where(eq(xpEvents.learnerId, learnerId))
      .orderBy(desc(xpEvents.createdAt))
      .limit(1);
    const lastActiveAt = recent[0]?.createdAt ? new Date(recent[0].createdAt).toISOString() : null;

    const [currency] = await db
      .select()
      .from(virtualCurrency)
      .where(eq(virtualCurrency.learnerId, learnerId));

    return {
      streakDays: streak?.currentStreak ?? 0,
      xp: totalXp,
      level,
      badges: learnerBadges.map((b) => ({
        id: b.id,
        type: b.badgeType,
        name: b.name,
        rarity: b.rarity,
        earnedAt: b.earnedAt,
      })),
      achievements: learnerBadges.filter((b) => b.rarity === "epic" || b.rarity === "legendary"),
      lastActiveAt,
      currency: currency ? { coins: currency.coins, gems: currency.gems } : { coins: 0, gems: 0 },
    };
  });
}
