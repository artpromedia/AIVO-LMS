/**
 * In-process integration coverage for services the Docker harness does not
 * start: engagement-svc, integration-svc, integrations-svc, subject-brain-svc,
 * tenant-svc. Each is booted via its real `buildApp` and driven with Fastify
 * `inject` — exercising health, auth enforcement, schema validation, and a
 * representative endpoint without Postgres or a live network.
 */
import { describe, it, expect, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp as buildEngagement } from "../../../services/engagement-svc/src/index.js";
import { buildApp as buildIntegration } from "../../../services/integration-svc/src/index.js";
import { buildApp as buildIntegrations } from "../../../services/integrations-svc/src/index.js";
import { buildApp as buildSubjectBrain } from "../../../services/subject-brain-svc/src/server.js";
import { buildApp as buildTenant } from "../../../services/tenant-svc/src/server.js";

const apps: FastifyInstance[] = [];
async function track(app: FastifyInstance): Promise<FastifyInstance> {
  apps.push(app);
  await app.ready();
  return app;
}
afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
});

describe("subject-brain-svc (stateless reasoner)", () => {
  it("serves health and reasons over a subject context", async () => {
    const app = await track(await buildSubjectBrain({ skipAuth: true }));

    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
    expect(health.json().service).toBe("subject-brain-svc");

    const ctx = await app.inject({
      method: "POST",
      url: "/api/subject-brain/context",
      payload: { learnerId: "l1", subject: "math", topic: "area of a rectangle", brainContext: {} },
    });
    expect(ctx.statusCode).toBe(200);
    expect(Array.isArray(ctx.json().recommendedSurfaces)).toBe(true);

    const bad = await app.inject({
      method: "POST",
      url: "/api/subject-brain/context",
      payload: { learnerId: "l1" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("enforces auth when the gate is on", async () => {
    const app = await track(await buildSubjectBrain());
    const res = await app.inject({
      method: "GET",
      url: "/api/subject-brain/skill-graph?subject=math",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("tenant-svc (platform authority)", () => {
  it("serves health and lists districts", async () => {
    const app = await track(await buildTenant({ skipAuth: true }));
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);

    const districts = await app.inject({ method: "GET", url: "/api/districts" });
    expect(districts.statusCode).toBe(200);
    expect(Array.isArray(districts.json().districts)).toBe(true);
  });

  it("rejects district access without a token", async () => {
    const app = await track(await buildTenant());
    const res = await app.inject({ method: "GET", url: "/api/districts" });
    expect(res.statusCode).toBe(401);
  });
});

describe("integration-svc (LTI 1.3)", () => {
  it("serves health and validates LTI launch payloads", async () => {
    const app = await track(await buildIntegration({ skipAuth: true, db: null }));
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);

    // Missing payload → 400 from the validator route.
    const res = await app.inject({ method: "POST", url: "/api/lti/validate", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe("integrations-svc (connector catalogue)", () => {
  it("serves the public connector catalogue", async () => {
    const app = await track(await buildIntegrations({} as any));
    const res = await app.inject({ method: "GET", url: "/api/integrations/connectors" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const connectors = body.connectors ?? body;
    expect((connectors as Array<{ id: string }>).map((c) => c.id)).toContain("google_classroom");
  });
});

describe("engagement-svc (XP / quests)", () => {
  it("serves health and enforces auth on learner-state reads", async () => {
    const app = await track(await buildEngagement({} as any));
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const protectedRes = await app.inject({ method: "GET", url: "/api/engagement/shop/items" });
    expect(protectedRes.statusCode).toBe(401);
  });
});
