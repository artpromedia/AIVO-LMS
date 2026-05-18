/**
 * Phase 5 — route-level specialisations:
 *   - starter content-pack fallback when body.contentPack is omitted
 *   - Echo delegates the live audio loop to Speech Buddy
 *   - Vigor accepts and echoes a `dapeProfile` for the chat layer
 *   - generic consent gate (dev short-circuit) is exercised via env
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { registerTutorSessionRoutes } from "../src/routes/tutorSession.js";

describe("tutor-svc plan route — Phase 5 specialisations", () => {
  let app: FastifyInstance;
  const envSnapshot: Record<string, string | undefined> = {};

  before(async () => {
    envSnapshot.TUTOR_DEV_CONSENTS = process.env.TUTOR_DEV_CONSENTS;
    process.env.TUTOR_DEV_CONSENTS = "t-dev:l-dev:dev-consent";
    app = Fastify({ logger: false });
    registerTutorSessionRoutes(app);
    await app.ready();
  });

  after(async () => {
    if (envSnapshot.TUTOR_DEV_CONSENTS === undefined) delete process.env.TUTOR_DEV_CONSENTS;
    else process.env.TUTOR_DEV_CONSENTS = envSnapshot.TUTOR_DEV_CONSENTS;
    await app.close();
  });

  it("falls back to the starter content pack when the request omits one", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/nova/plan",
      payload: { learnerId: "l1", consentRecordId: "c-existing" },
    });
    assert.equal(res.statusCode, 200);
    const plan = res.json() as {
      contentPackSource: string;
      activities: unknown[];
    };
    assert.equal(plan.contentPackSource, "starter");
    assert.ok(Array.isArray(plan.activities) && plan.activities.length > 0);
  });

  it("returns a Speech Buddy delegate marker for echo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/echo/plan",
      payload: { learnerId: "l1", consentRecordId: "c-existing" },
    });
    assert.equal(res.statusCode, 200);
    const plan = res.json() as {
      delegate?: { kind: string; endpoint: string };
    };
    assert.ok(plan.delegate, "echo plan must carry a delegate marker");
    assert.equal(plan.delegate?.kind, "speech-buddy");
    assert.match(plan.delegate?.endpoint ?? "", /speech-buddy/);
  });

  it("does NOT delegate for non-echo tutors", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/nova/plan",
      payload: { learnerId: "l1", consentRecordId: "c-existing" },
    });
    const plan = res.json() as { delegate?: unknown };
    assert.equal(plan.delegate, undefined);
  });

  it("Vigor echoes a supplied dapeProfile on the response", async () => {
    const dapeProfile = {
      active: true,
      source: "service+goal",
      totalMotorGoals: 3,
      categories: [{ id: "locomotor", label: "Locomotor", goalCount: 2, sampleGoal: "..." }],
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/vigor/plan",
      payload: {
        learnerId: "l1",
        consentRecordId: "c-existing",
        dapeProfile,
      },
    });
    assert.equal(res.statusCode, 200);
    const plan = res.json() as { dapeProfile?: typeof dapeProfile };
    assert.deepEqual(plan.dapeProfile, dapeProfile);
  });

  it("Nova does NOT echo dapeProfile (Vigor-only field)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/nova/plan",
      payload: {
        learnerId: "l1",
        consentRecordId: "c-existing",
        dapeProfile: { active: true, source: "goal", totalMotorGoals: 1, categories: [] },
      },
    });
    const plan = res.json() as { dapeProfile?: unknown };
    assert.equal(plan.dapeProfile, undefined);
  });

  it("uses TUTOR_DEV_CONSENTS to grant a missing consent for harmony", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/harmony/plan",
      payload: {
        learnerId: "l-dev",
        tenantId: "t-dev",
        // no consentRecordId — the dev consent registry should resolve it.
      },
    });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.body}`);
    const plan = res.json() as { contentPackSource: string };
    // We didn't supply a content pack either; the starter pack should kick in.
    assert.equal(plan.contentPackSource, "starter");
  });

  it("still 403s for a consent-required tutor when no tenantId is provided", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/harmony/plan",
      payload: { learnerId: "l-no-tenant" },
    });
    // The verifier needs a tenantId to call family-svc; without it we
    // fall through to checkPolicy which raises consent_missing → 403.
    assert.equal(res.statusCode, 403);
  });
});
