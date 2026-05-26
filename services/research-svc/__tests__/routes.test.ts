/**
 * Sprint 12.6 — unit coverage for the research / analytics routes.
 *
 * The research-svc routes all require an admin role and exercise
 * @aivo/db reads (count() over learners, tutorSessions; select() over
 * learners for the anonymised export). The service has no real DB
 * in unit-test scope — we substitute a deterministic stub that mimics
 * the drizzle query-builder shape the route uses.
 *
 * Routes covered:
 *   • GET  /api/research/cohorts                 — auth + cohort shape
 *   • GET  /api/research/metrics/engagement      — db count round-trip
 *   • GET  /api/research/metrics/mastery         — deterministic payload
 *   • GET  /api/research/export/anonymized       — strips PII (no email,
 *                                                  no real ids) and emits
 *                                                  a participant code
 *   • GET  /api/research/reports                 — empty-list contract
 */
import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { signJWT } from "@aivo/security";
import { registerAnalyticsRoutes } from "../src/routes/analytics.js";

interface DbCall {
  table?: string;
  op: "select" | "insert" | "update" | "delete";
}

function makeStubDb(opts: {
  learnerCount?: number;
  tutorSessionCount?: number;
  learners?: Array<{ id: string; functioningLevel: string | null; createdAt: Date }>;
}) {
  const calls: DbCall[] = [];
  const learnerRows = opts.learners ?? [
    { id: "lrn-1", functioningLevel: "STANDARD", createdAt: new Date("2026-01-01") },
    { id: "lrn-2", functioningLevel: null, createdAt: new Date("2026-02-01") },
  ];
  const counts = {
    learners: opts.learnerCount ?? 2,
    tutorSessions: opts.tutorSessionCount ?? 17,
  };
  return {
    calls,
    select(projection?: any) {
      // Two shapes are used: `select({ count })` and
      // `select({ id, functioningLevel, createdAt })`. We detect the
      // count case by the presence of a single `count` key.
      const wantsCount =
        projection && typeof projection === "object" && "count" in projection;
      return {
        from(table: any) {
          const name = (table?.[Symbol.for("drizzle:Name")] ?? table?.name ?? "") as string;
          calls.push({ table: name, op: "select" });
          if (wantsCount) {
            const tableName = String(name);
            const c =
              tableName.includes("tutor") || tableName.includes("session")
                ? counts.tutorSessions
                : counts.learners;
            return Promise.resolve([{ count: c }]) as any;
          }
          return Promise.resolve(learnerRows) as any;
        },
      };
    },
  } as any;
}

async function adminToken(role: "PLATFORM_ADMIN" | "DISTRICT_ADMIN" = "PLATFORM_ADMIN") {
  return signJWT({
    sub: "user-1",
    role,
    email: "researcher@example.test",
    tenantId: role === "DISTRICT_ADMIN" ? "tenant-1" : null,
    name: "Researcher",
  } as any);
}

async function buildApp(db: any): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerAnalyticsRoutes(app, db);
  await app.ready();
  return app;
}

describe("research-svc analytics routes", () => {
  let app: FastifyInstance;
  let db: ReturnType<typeof makeStubDb>;

  beforeAll(async () => {
    db = makeStubDb({ learnerCount: 5, tutorSessionCount: 42 });
    app = await buildApp(db);
  });

  it("rejects unauthenticated callers on every route", async () => {
    for (const url of [
      "/api/research/cohorts",
      "/api/research/metrics/engagement",
      "/api/research/metrics/mastery",
      "/api/research/export/anonymized",
      "/api/research/reports",
    ]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, `${url} must require auth`).toBe(401);
    }
  });

  it("rejects non-admin tokens with 403", async () => {
    const token = await signJWT({
      sub: "u",
      role: "LEARNER",
      email: "l@x",
      tenantId: null,
      name: "L",
    } as any);
    const res = await app.inject({
      method: "GET",
      url: "/api/research/cohorts",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /api/research/cohorts returns the cohort list seeded by the learner count", async () => {
    const token = await adminToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/research/cohorts",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.cohorts)).toBe(true);
    expect(body.cohorts[0].id).toBe("all");
    expect(body.cohorts[0].count).toBe(5);
    // The 5 functioning-level cohorts must be enumerated even when
    // their counts are zero.
    expect(body.cohorts.length).toBeGreaterThanOrEqual(6);
  });

  it("GET /api/research/metrics/engagement round-trips the tutor session count from the db", async () => {
    const token = await adminToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/research/metrics/engagement",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.period).toBe("30d");
    expect(body.totalSessions).toBe(42);
  });

  it("GET /api/research/metrics/mastery returns the subject-breakdown contract", async () => {
    const token = await adminToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/research/metrics/mastery",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.subjectBreakdown.math).toBeTruthy();
    expect(body.subjectBreakdown.ela).toBeTruthy();
    expect(body.subjectBreakdown.science).toBeTruthy();
  });

  it("GET /api/research/export/anonymized strips PII and emits stable participant codes", async () => {
    const token = await adminToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/research/export/anonymized",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.format).toBe("AIVO_RESEARCH_EXPORT_v1");
    expect(Array.isArray(body.participants)).toBe(true);
    expect(body.participants.length).toBe(2);
    for (const p of body.participants) {
      // No raw learner ids, emails, or names — only participant codes
      // and the functioningLevel signal.
      expect(p.participantId).toMatch(/^P\d{4}$/);
      expect(p.email).toBeUndefined();
      expect(p.name).toBeUndefined();
      expect(p.id).toBeUndefined();
      expect(typeof p.functioningLevel).toBe("string");
    }
    // Null functioningLevel falls back to STANDARD.
    const fallback = body.participants.find((p: any) => p.participantId === "P0002");
    expect(fallback.functioningLevel).toBe("STANDARD");
  });

  it("GET /api/research/reports returns an empty list (admin-only stub)", async () => {
    const token = await adminToken();
    const res = await app.inject({
      method: "GET",
      url: "/api/research/reports",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reports).toEqual([]);
  });
});
