/**
 * Test-mode helpers for the admin console e2e suites. Mirrors identity-svc's
 * /api/__test__/* convention: enabled only when ADMIN_TEST_MODE=1 AND the
 * process is not production, so none of this surface exists in a deploy.
 *
 * Two capabilities:
 *  - fault injection: flip a named route into a 503 so specs can prove the
 *    web-admin dashboard degrades per-widget instead of all-or-nothing.
 *  - seed-platform-metrics: deterministic ai_usage_log / lesson_runs /
 *    subscriptions rows (plus one tenant of each kind) so the platform
 *    overview's charts are computed from real database reads.
 *
 * Seeding is idempotent: every row this helper writes carries the
 * `e2e-metrics` marker (model / plan / fixed ids) and is deleted and
 * re-inserted on each call, so reruns never inflate the metrics.
 */
import type { FastifyInstance } from "fastify";
import { aiUsageLog, lessonRuns, subscriptions, tenants, users } from "@aivo/db";
import { eq } from "drizzle-orm";

const MARKER = "e2e-metrics";

function testModeEnabled(): boolean {
  return process.env.ADMIN_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
}

const faults = new Set<string>();

/** True when a spec has injected a fault for this route (test mode only). */
export function testFaultEnabled(route: string): boolean {
  return testModeEnabled() && faults.has(route);
}

interface SeedBody {
  aiEvents?: Array<{
    minutesAgo: number;
    latencyMs?: number;
    estimatedCostUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
  }>;
  lessonRuns?: { completed: number; failed: number };
  trials?: {
    trialsStarted: number;
    converted: number;
    pilotsStarted: number;
    pilotsConverted: number;
  };
}

export function registerAdminTestHelperRoutes(app: FastifyInstance, db: any) {
  if (!testModeEnabled()) return;

  app.get("/api/__test__/health", async () => ({ ok: true, mode: "test", service: "admin-svc" }));

  app.post<{ Body: { route?: string; enabled?: boolean } }>(
    "/api/__test__/fault",
    async (req, reply) => {
      const { route, enabled } = req.body ?? {};
      if (!route) return reply.status(400).send({ error: "route required" });
      if (enabled) faults.add(route);
      else faults.delete(route);
      return { ok: true, route, enabled: Boolean(enabled), active: [...faults] };
    },
  );

  app.post<{ Body: SeedBody }>("/api/__test__/seed-platform-metrics", async (req) => {
    const body = req.body ?? {};
    const now = new Date();
    const minutes = (n: number) => new Date(now.getTime() - n * 60 * 1000);
    const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    // One tenant of each kind so the tenant-mix donut always has its three
    // categories, plus a marker user for the subscriptions FK.
    const tenantOfKind = async (kind: "B2B_DISTRICT" | "B2B_SCHOOL" | "B2C_FAMILY") => {
      const name = `E2E Metrics ${kind} Tenant`;
      const [existing] = await db.select().from(tenants).where(eq(tenants.name, name)).limit(1);
      if (existing) return existing;
      const [created] = await db
        .insert(tenants)
        .values({ name, type: kind })
        .returning();
      return created;
    };
    const district = await tenantOfKind("B2B_DISTRICT");
    const school = await tenantOfKind("B2B_SCHOOL");
    const family = await tenantOfKind("B2C_FAMILY");

    const markerEmail = "e2e-metrics@aivo.test";
    let [markerUser] = await db.select().from(users).where(eq(users.email, markerEmail)).limit(1);
    if (!markerUser) {
      [markerUser] = await db
        .insert(users)
        .values({
          email: markerEmail,
          name: "E2E Metrics User",
          role: "PARENT",
          tenantId: family.id,
          passwordHash: "e2e-metrics-no-login",
        })
        .returning();
    }

    // AI usage events (drives ai-activity buckets + aiEstimatedCostUsd24h).
    const aiEvents =
      body.aiEvents ??
      Array.from({ length: 12 }, (_, i) => ({
        // Three events per hour over the last 4 hours, costlier when recent
        // so the AI-cost KPI delta (last 12h vs prior 12h) is positive.
        minutesAgo: i * 20 + 5,
        latencyMs: 400 + i * 25,
        estimatedCostUsd: 0.05,
        inputTokens: 800,
        outputTokens: 200,
      }));
    await db.delete(aiUsageLog).where(eq(aiUsageLog.model, MARKER));
    if (aiEvents.length > 0) {
      await db.insert(aiUsageLog).values(
        aiEvents.map((event) => ({
          provider: "e2e",
          model: MARKER,
          inputTokens: event.inputTokens ?? 800,
          outputTokens: event.outputTokens ?? 200,
          latencyMs: event.latencyMs ?? 500,
          estimatedCostUsd: String(event.estimatedCostUsd ?? 0.05),
          createdAt: minutes(event.minutesAgo),
        })),
      );
    }

    // Lesson runs (drives the completion gauge). Fixed ids => idempotent.
    const runs = body.lessonRuns ?? { completed: 18, failed: 6 };
    const runRows = [
      ...Array.from({ length: runs.completed }, (_, i) => ({
        id: `${MARKER}-run-completed-${i}`,
        status: "completed",
      })),
      ...Array.from({ length: runs.failed }, (_, i) => ({
        id: `${MARKER}-run-failed-${i}`,
        status: "failed",
      })),
    ];
    for (const row of runRows) {
      await db
        .insert(lessonRuns)
        .values({
          id: row.id,
          tenantId: family.id,
          learnerId: `${MARKER}-learner`,
          status: row.status,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
        .onConflictDoNothing();
    }

    // Subscriptions (drives the trial → conversion funnel). Marker plan rows
    // are replaced wholesale. Pilot rows carry couponCode metadata and no
    // trialEndsAt so the trial and pilot tallies stay independent.
    const trials = body.trials ?? {
      trialsStarted: 40,
      converted: 20,
      pilotsStarted: 8,
      pilotsConverted: 5,
    };
    await db.delete(subscriptions).where(eq(subscriptions.plan, MARKER));
    const subRows: Array<Record<string, unknown>> = [];
    const base = {
      tenantId: family.id,
      userId: markerUser.id,
      plan: MARKER,
    };
    for (let i = 0; i < trials.trialsStarted - trials.converted; i += 1) {
      subRows.push({
        ...base,
        status: "TRIALING",
        trialEndsAt: days(-14), // two weeks out
        createdAt: days(2),
      });
    }
    for (let i = 0; i < trials.converted; i += 1) {
      subRows.push({ ...base, status: "ACTIVE", trialEndsAt: days(1), createdAt: days(3) });
    }
    for (let i = 0; i < trials.pilotsConverted; i += 1) {
      subRows.push({
        ...base,
        status: "ACTIVE",
        metadata: { couponCode: "E2E-METRICS" },
        createdAt: days(5),
      });
    }
    for (let i = 0; i < trials.pilotsStarted - trials.pilotsConverted; i += 1) {
      subRows.push({
        ...base,
        status: "CANCELLED",
        metadata: { couponCode: "E2E-METRICS" },
        createdAt: days(6),
      });
    }
    if (subRows.length > 0) await db.insert(subscriptions).values(subRows);

    return {
      ok: true,
      tenants: { district: district.id, school: school.id, family: family.id },
      seeded: {
        aiEvents: aiEvents.length,
        lessonRuns: runRows.length,
        subscriptions: subRows.length,
      },
    };
  });
}
