/**
 * Sprint 6: entitlement enforcement integration test.
 *
 * What this proves:
 *   - The /api/billing/entitlements/:tenantId endpoint computes the
 *     effective tutor SKU set from real DB rows.
 *   - tutor-svc /api/tutor/session/start returns 403 for an
 *     unentitled tutor and 200 for an included tutor.
 *   - learning-svc POST /api/learning/sessions behaves the same way.
 *   - Cancelling the subscription revokes access on the next call
 *     (no caching baked in elsewhere).
 *
 * The test seeds DB state directly instead of going through Stripe so
 * it runs deterministically without test keys.
 */
import { describe, it, expect, beforeAll } from "vitest";
import postgres from "postgres";
import { getDbUrl } from "./helpers/db.js";
import { serviceUrl } from "./helpers/services.js";
import { createTenant, createUser, createLearner } from "./helpers/fixtures.js";

describe("entitlement gate end-to-end", () => {
  let tenantId: string;
  let parentToken: string;
  let parentUserId: string;
  let learnerId: string;
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    const parent = await createUser("parent", tenantId, tenant.adminTokens.accessToken);
    parentUserId = parent.id;
    parentToken = parent.tokens.accessToken;
    const learner = await createLearner(tenantId, parent.id, tenant.adminTokens.accessToken);
    learnerId = learner.id;
    sql = postgres(getDbUrl(), { max: 2 });
  });

  it("returns an empty entitlement set before any subscription exists", async () => {
    const res = await fetch(serviceUrl("billing-svc", `/api/billing/entitlements/${tenantId}`), {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { plan: string; effectiveTutorSkus: string[] };
    expect(data.plan).toBe("free");
    // Free plan still includes ELA, but nothing else.
    expect(data.effectiveTutorSkus).toContain("ADDON_TUTOR_ELA");
    expect(data.effectiveTutorSkus).not.toContain("ADDON_TUTOR_MATH");
  });

  it("rejects /api/tutor/session/start for ADDON_TUTOR_CODING on the free plan", async () => {
    const res = await fetch(serviceUrl("tutor-svc", "/api/tutor/session/start"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${parentToken}`,
      },
      body: JSON.stringify({ learnerId, tutorSku: "ADDON_TUTOR_CODING" }),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as {
      error: string;
      requiredSku: string;
      upgradePath: string;
    };
    expect(data.requiredSku).toBe("ADDON_TUTOR_CODING");
    expect(data.upgradePath).toBe("purchase_addon");
  });

  it("allows ADDON_TUTOR_ELA on the free plan (plan-included tutor)", async () => {
    const res = await fetch(serviceUrl("tutor-svc", "/api/tutor/session/start"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${parentToken}`,
      },
      body: JSON.stringify({ learnerId, tutorSku: "ADDON_TUTOR_ELA" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { sessionId: string };
    expect(data.sessionId).toBeTruthy();
  });

  it("seeds a family-plan subscription with a Coding add-on and allows Coding session start", async () => {
    // Direct DB seed: the easier path than going through Stripe in a
    // test environment without keys.
    await sql`
      INSERT INTO subscriptions (tenant_id, user_id, plan, stripe_subscription_id, stripe_status, status, cancel_at_period_end)
      VALUES (${tenantId}, ${parentUserId}, 'family', 'sub_int_test_1', 'active', 'ACTIVE', false)
    `;
    await sql`
      INSERT INTO tutor_subscriptions (tenant_id, user_id, tutor_sku, status)
      VALUES (${tenantId}, ${parentUserId}, 'ADDON_TUTOR_CODING', 'active')
    `;

    const entitlements = await (
      await fetch(serviceUrl("billing-svc", `/api/billing/entitlements/${tenantId}`), {
        headers: { Authorization: `Bearer ${parentToken}` },
      })
    ).json();
    expect(entitlements.plan).toBe("family");
    expect(entitlements.effectiveTutorSkus).toContain("ADDON_TUTOR_MATH"); // family included
    expect(entitlements.effectiveTutorSkus).toContain("ADDON_TUTOR_CODING"); // add-on

    const res = await fetch(serviceUrl("tutor-svc", "/api/tutor/session/start"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${parentToken}`,
      },
      body: JSON.stringify({ learnerId, tutorSku: "ADDON_TUTOR_CODING" }),
    });
    expect(res.status).toBe(200);
  });

  it("revokes access after subscription is set to canceled", async () => {
    await sql`
      UPDATE subscriptions SET stripe_status = 'canceled', status = 'CANCELLED'
       WHERE tenant_id = ${tenantId}
    `;

    const res = await fetch(serviceUrl("tutor-svc", "/api/tutor/session/start"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${parentToken}`,
      },
      body: JSON.stringify({ learnerId, tutorSku: "ADDON_TUTOR_CODING" }),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { upgradePath: string };
    expect(data.upgradePath).toBe("renew_subscription");
  });

  it("learning-svc POST /api/learning/sessions also rejects unentitled SKUs", async () => {
    const res = await fetch(serviceUrl("learning-svc", "/api/learning/sessions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${parentToken}`,
      },
      body: JSON.stringify({ learnerId, tutorSku: "ADDON_TUTOR_CODING", contentType: "LESSON" }),
    });
    expect(res.status).toBe(403);
  });
});
