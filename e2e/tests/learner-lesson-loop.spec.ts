/**
 * Learner lesson loop end-to-end.
 *
 * Exercises the core "learner does a tutor session" backend chain:
 *
 *   1. Identity-svc seeds a parent + learner (idempotent test helpers).
 *   2. Billing-svc receives a Stripe `customer.subscription.created`
 *      event so the tenant is on the family plan and entitled to the
 *      tutor SKU under test.
 *   3. Tutor-svc accepts POST /api/tutor/session/start for that
 *      learner + tutor SKU → returns sessionId.
 *   4. Tutor-svc accepts POST /api/tutor/session/:id/complete → marks
 *      completedAt and stamps xpEarned.
 *   5. GET /api/tutor/session/:id reflects the completed state.
 *
 * The /message step is intentionally skipped: it round-trips through
 * ai-svc and asserting on an LLM response is brittle. The flow it
 * traces — entitlement gate → session row persistence → completion
 * mark — is the durability surface that production needs to keep
 * green.
 *
 * Also covers the negative case: without an entitlement, /session/start
 * returns 403 with the documented `requiredSku` / `upgradePath` shape
 * the learner UI uses to render the "Tutor not included" panel.
 *
 * The spec auto-skips when:
 *   - IDENTITY_TEST_MODE=1 or BILLING_TEST_MODE=1 is off.
 *   - tutor-svc isn't reachable.
 */
import { test, expect, request as pwRequest } from "@playwright/test";

const IDENTITY_BASE = process.env.IDENTITY_BASE_URL || "http://localhost:3001";
const BILLING_BASE = process.env.BILLING_BASE_URL || "http://localhost:3009";
const TUTOR_BASE = process.env.TUTOR_SVC_URL || "http://localhost:3006";

const EMAIL = process.env.E2E_LEARNER_PARENT_EMAIL || "e2e-lesson-parent@example.test";
const PASSWORD = process.env.E2E_LEARNER_PARENT_PASSWORD || "E2eLesson!Pass1";
// "pixel" maps to a Coding tutor SKU in the family plan. The actual
// SKU string is owned by @aivo/billing-entitlements; we read it back
// from the entitlements API rather than hard-coding it here.
const FALLBACK_TUTOR_SKU = "tutor_pixel";

async function probe(baseURL: string, path: string, init?: {
  method?: string;
  data?: unknown;
  token?: string;
}) {
  const ctx = await pwRequest.newContext({ baseURL });
  const headers: Record<string, string> = {};
  if (init?.data !== undefined) headers["content-type"] = "application/json";
  if (init?.token) headers["authorization"] = `Bearer ${init.token}`;
  const res = await ctx.fetch(path, {
    method: init?.method ?? "GET",
    data: init?.data !== undefined ? JSON.stringify(init.data) : undefined,
    headers,
    failOnStatusCode: false,
  });
  const status = res.status();
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* noop */
  }
  await ctx.dispose();
  return { status, json };
}

async function identityTestModeOn(): Promise<boolean> {
  const r = await probe(IDENTITY_BASE, "/api/__test__/health");
  return r.status === 200;
}
async function billingTestModeOn(): Promise<boolean> {
  const r = await probe(BILLING_BASE, "/api/__test__/billing/reset", {
    method: "POST",
    data: { tenantId: "00000000-0000-0000-0000-000000000000" },
  });
  return r.status === 200 || r.status === 400;
}
async function tutorReachable(): Promise<boolean> {
  try {
    const r = await probe(TUTOR_BASE, "/health");
    return r.status === 200;
  } catch {
    return false;
  }
}

test.describe("learner lesson loop", () => {
  let tenantId: string;
  let parentId: string;
  let parentToken: string;
  let learnerId: string;
  let entitledTutorSku: string = FALLBACK_TUTOR_SKU;

  test.beforeAll(async () => {
    if (!(await identityTestModeOn())) {
      test.skip(true, "IDENTITY_TEST_MODE=1 helper /api/__test__/health unreachable");
    }
    if (!(await billingTestModeOn())) {
      test.skip(true, "BILLING_TEST_MODE=1 helpers unreachable on billing-svc");
    }
    if (!(await tutorReachable())) {
      test.skip(true, "tutor-svc /health unreachable");
    }
    const seeded = await probe(IDENTITY_BASE, "/api/__test__/seed-parent", {
      method: "POST",
      data: { email: EMAIL, password: PASSWORD },
    });
    if (seeded.status !== 200) {
      test.skip(true, `seed-parent failed: ${seeded.status} ${JSON.stringify(seeded.json)}`);
    }
    tenantId = seeded.json.tenantId;
    parentId = seeded.json.userId;
    parentToken = seeded.json.accessToken;

    const learner = await probe(IDENTITY_BASE, "/api/__test__/seed-learner", {
      method: "POST",
      data: { parentUserId: parentId, tenantId, name: "E2E Lesson Learner" },
    });
    if (learner.status !== 200) {
      test.skip(true, `seed-learner failed: ${learner.status} ${JSON.stringify(learner.json)}`);
    }
    learnerId = learner.json.learnerId;
  });

  test.beforeEach(async () => {
    // Reset billing so each test starts from a clean entitlement state.
    await probe(BILLING_BASE, "/api/__test__/billing/reset", {
      method: "POST",
      data: { tenantId },
    });
  });

  test("free-plan learner gets 403 with upgrade hint on session start", async () => {
    // No subscription seeded → tenant is on the implicit free plan.
    const start = await probe(TUTOR_BASE, "/api/tutor/session/start", {
      method: "POST",
      data: { learnerId, tutorSku: entitledTutorSku, sessionType: "standard" },
      token: parentToken,
    });
    expect(start.status).toBe(403);
    expect(start.json).toMatchObject({
      error: expect.stringMatching(/not included|locked|subscription/i),
    });
    // The body must include enough metadata for the learner UI to render
    // the "Tutor not included" panel + an upgrade CTA.
    expect(start.json.requiredSku || start.json.upgradePath).toBeTruthy();
  });

  test("family-plan learner can start → complete a tutor session end-to-end", async () => {
    // Put the tenant on the family plan via a synthetic Stripe event.
    const now = Math.floor(Date.now() / 1000);
    const dispatch = await probe(BILLING_BASE, "/api/__test__/billing/dispatch-webhook", {
      method: "POST",
      data: {
        type: "customer.subscription.created",
        created: now,
        data: {
          object: {
            id: `sub_e2e_lesson_${Date.now()}`,
            object: "subscription",
            customer: `cus_e2e_lesson_${Date.now()}`,
            status: "active",
            current_period_start: now - 60,
            current_period_end: now + 30 * 24 * 60 * 60,
            cancel_at_period_end: false,
            metadata: { aivo_tenant_id: tenantId, aivo_plan: "family" },
            items: {
              data: [
                {
                  id: `si_e2e_${Date.now()}`,
                  price: { id: "price_family_monthly", metadata: { aivo_plan: "family" } },
                  metadata: { aivo_plan: "family" },
                },
              ],
            },
          },
        },
      },
    });
    expect(dispatch.status).toBe(200);

    // Pull the actual entitled SKUs so the test isn't fragile to
    // billing-entitlements changes. We just need *any* SKU the family
    // plan includes.
    const ent = await probe(BILLING_BASE, `/api/billing/entitlements/${tenantId}`, {
      token: parentToken,
    });
    expect(ent.status).toBe(200);
    const effective: string[] = ent.json?.effectiveTutorSkus ?? [];
    expect(effective.length).toBeGreaterThan(0);
    entitledTutorSku = effective.includes(FALLBACK_TUTOR_SKU)
      ? FALLBACK_TUTOR_SKU
      : effective[0]!;

    // 1. Start the session.
    const start = await probe(TUTOR_BASE, "/api/tutor/session/start", {
      method: "POST",
      data: { learnerId, tutorSku: entitledTutorSku, sessionType: "standard" },
      token: parentToken,
    });
    expect(start.status).toBe(200);
    expect(start.json.sessionId).toBeTruthy();
    const sessionId = start.json.sessionId;

    // 2. Complete the session with a small mastery bump + manual XP.
    //    We pass an explicit xpEarned so the assertion is deterministic
    //    (the auto-computed value depends on signals like message count
    //    which we don't drive here).
    const complete = await probe(TUTOR_BASE, `/api/tutor/session/${sessionId}/complete`, {
      method: "POST",
      data: {
        masteryUpdates: { "letter-sounds": 0.55 },
        xpEarned: 42,
        beatsCompleted: 3,
        beatsTotal: 3,
        correctAnswers: 3,
        attemptedAnswers: 3,
      },
      token: parentToken,
    });
    expect(complete.status).toBe(200);
    expect(complete.json).toMatchObject({
      status: "completed",
      sessionId,
      xpEarned: 42,
    });
    expect(typeof complete.json.durationSeconds).toBe("number");

    // 3. The session row should reflect the completed state on read.
    const fetched = await probe(TUTOR_BASE, `/api/tutor/session/${sessionId}`, {
      token: parentToken,
    });
    expect(fetched.status).toBe(200);
    const row = fetched.json;
    // shape is `{ session: { ... } }` in some configurations or flat
    // depending on serializer — handle both.
    const session = row.session ?? row;
    expect(session.completedAt ?? session.completed_at).toBeTruthy();
    expect(session.xpEarned ?? session.xp_earned).toBe(42);
  });

  test("session start with no learnerId is rejected", async () => {
    const r = await probe(TUTOR_BASE, "/api/tutor/session/start", {
      method: "POST",
      data: { tutorSku: entitledTutorSku },
      token: parentToken,
    });
    expect([400, 422]).toContain(r.status);
  });

  test("unauthenticated session start returns 401", async () => {
    const r = await probe(TUTOR_BASE, "/api/tutor/session/start", {
      method: "POST",
      data: { learnerId, tutorSku: entitledTutorSku },
    });
    expect(r.status).toBe(401);
  });
});
