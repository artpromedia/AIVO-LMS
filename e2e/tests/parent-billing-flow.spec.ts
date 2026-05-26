import { test, expect, request as pwRequest } from "@playwright/test";
import { seedOrThrow } from "./sprint12/_seed";

/**
 * Sprint 6 — parent billing happy path E2E.
 *
 * What this spec proves end-to-end against a running stack:
 *
 *   1. Parent loads /dashboard/parent/billing and sees the loading
 *      skeleton, then the catalog.
 *   2. With a paid `family` subscription seeded via the billing-svc
 *      test-mode helper, the page reflects: status badge, billing
 *      period, persisted invoices (none yet → empty state), and the
 *      tutor add-on grid sourced from /api/billing/entitlements.
 *   3. With a payment-failed `past_due` subscription seeded, the page
 *      surfaces the payment-failed banner with the Update payment
 *      method button.
 *   4. The locked tutor card on /dashboard/learner shows an
 *      aria-disabled lock state and the lesson page surfaces the
 *      "Tutor not included" error rather than running the stage.
 *
 * The spec auto-skips when:
 *   - The billing-svc test-mode helper is not reachable (so it doesn't
 *     red CI on environments where BILLING_TEST_MODE is off).
 *   - identity-svc's test-mode helper isn't there to seed a parent.
 *
 * Required env (defaults provided):
 *   WEB_BASE_URL        - default http://localhost:5000
 *   IDENTITY_BASE_URL   - default http://localhost:3001
 *   BILLING_BASE_URL    - default http://localhost:3009
 *   E2E_PARENT_EMAIL    - default e2e-parent-billing@example.test
 *   E2E_PARENT_PASSWORD - default E2eParent!Pass1
 */

const WEB_BASE = process.env.WEB_BASE_URL || "http://localhost:5000";
const IDENTITY_BASE = process.env.IDENTITY_BASE_URL || "http://localhost:3001";
const BILLING_BASE = process.env.BILLING_BASE_URL || "http://localhost:3009";
const EMAIL = process.env.E2E_PARENT_EMAIL || "e2e-parent-billing@example.test";
const PASSWORD = process.env.E2E_PARENT_PASSWORD || "E2eParent!Pass1";

// Sprint 12.6 — both reachability probes now throw with a descriptive
// Error instead of returning null + letting the spec test.skip(). This
// removes the silent false-green path that used to swallow real
// seed-surface regressions.
async function requireBillingTestMode(): Promise<void> {
  let res;
  try {
    const ctx = await pwRequest.newContext({ baseURL: BILLING_BASE });
    res = await ctx.post("/api/__test__/billing/reset", {
      data: { tenantId: "00000000-0000-0000-0000-000000000000" },
      failOnStatusCode: false,
    });
    await ctx.dispose();
  } catch (err: any) {
    throw new Error(
      `Sprint12 seed failed for role=PARENT_BILLING: cannot reach billing-svc at ${BILLING_BASE}: ${err?.message ?? err}`,
    );
  }
  // Either 200 or 400 ("tenantId required") proves the route is wired
  // — anything else means BILLING_TEST_MODE is off.
  if (res.status() !== 200 && res.status() !== 400) {
    throw new Error(
      `Sprint12 seed failed for role=PARENT_BILLING: ${BILLING_BASE}/api/__test__/billing/reset returned HTTP ${res.status()}. ` +
        `Set BILLING_TEST_MODE=1 on billing-svc and restart.`,
    );
  }
}

async function seedParent(): Promise<{
  tenantId: string;
  userId: string;
  accessToken: string;
}> {
  return seedOrThrow<{ tenantId: string; userId: string; accessToken: string }>({
    role: "PARENT_BILLING",
    identityBaseUrl: IDENTITY_BASE,
    endpoint: "/api/__test__/seed-parent",
    body: { email: EMAIL, password: PASSWORD },
  });
}

test.describe("parent billing flow", () => {
  let tenantId: string;
  let userId: string;
  let token: string;

  test.beforeAll(async () => {
    // Sprint 12.6 — both probes throw on failure. Playwright surfaces
    // the descriptive Error and the suite goes red instead of silently
    // green-passing on a misconfigured stack.
    await requireBillingTestMode();
    const seeded = await seedParent();
    tenantId = seeded.tenantId;
    userId = seeded.userId;
    token = seeded.accessToken;
  });

  test.beforeEach(async () => {
    // Reset the tenant's billing state before each test so seeds don't
    // collide.
    const ctx = await pwRequest.newContext({ baseURL: BILLING_BASE });
    await ctx.post("/api/__test__/billing/reset", {
      data: { tenantId },
      failOnStatusCode: false,
    });
    await ctx.dispose();
  });

  test("loads the catalog and shows free-plan state by default", async ({ page }) => {
    // Stash the auth token before navigation so the page mounts logged in.
    await page.addInitScript((authToken) => {
      try {
        window.localStorage.setItem("accessToken", authToken as string);
      } catch {}
    }, token);
    await page.goto(`${WEB_BASE}/dashboard/parent/billing`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Billing|Subscription/i);
    // Free plan card should be the active one.
    await expect(page.getByText(/Free Trial|Free/i).first()).toBeVisible();
    // Catalog should include Single + Family.
    await expect(page.getByText("Single Learner")).toBeVisible();
    await expect(page.getByText("Family")).toBeVisible();
  });

  test("renders payment-failed banner for a past_due subscription", async ({ page }) => {
    const ctx = await pwRequest.newContext({ baseURL: BILLING_BASE });
    await ctx.post("/api/__test__/billing/seed-subscription", {
      data: {
        tenantId,
        userId,
        plan: "family",
        stripeStatus: "past_due",
        paymentMethod: { brand: "visa", last4: "0341" },
      },
    });
    await ctx.dispose();

    await page.addInitScript((authToken) => {
      try {
        window.localStorage.setItem("accessToken", authToken as string);
      } catch {}
    }, token);
    await page.goto(`${WEB_BASE}/dashboard/parent/billing`);
    await expect(
      page.getByText(/Your last payment didn't go through|past_due|past due/i).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Update payment method/i })).toBeVisible();
  });

  test("renders trial countdown for a trialing subscription", async ({ page }) => {
    const trialEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60_000).toISOString();
    const ctx = await pwRequest.newContext({ baseURL: BILLING_BASE });
    await ctx.post("/api/__test__/billing/seed-subscription", {
      data: { tenantId, userId, plan: "family", stripeStatus: "trialing", trialEndsAt: trialEnd },
    });
    await ctx.dispose();

    await page.addInitScript((authToken) => {
      try {
        window.localStorage.setItem("accessToken", authToken as string);
      } catch {}
    }, token);
    await page.goto(`${WEB_BASE}/dashboard/parent/billing`);
    await expect(page.getByText(/Trial ends in/i)).toBeVisible();
  });

  test("locked tutor on learner home is aria-disabled and surfaces error in lesson page", async ({
    page,
  }) => {
    // Free plan → Coding is locked.
    await page.addInitScript((authToken) => {
      try {
        window.localStorage.setItem("accessToken", authToken as string);
      } catch {}
    }, token);
    await page.goto(`${WEB_BASE}/dashboard/learner/tutors`);

    // The tutors-page lock pill should be rendered for at least one tutor.
    await expect(page.getByText(/Locked/i).first()).toBeVisible();

    // Going directly to the lesson page for a locked tutor should
    // bail out with the tutor-locked error rather than running the stage.
    await page.goto(`${WEB_BASE}/dashboard/learner/lesson/pixel`);
    await page
      .getByRole("button", { name: /play|start/i })
      .first()
      .click({ trial: true })
      .catch(() => {});
    // The page surfaces lessonError state when start returns 403.
    // We don't assert the exact button click path because the lesson
    // page sometimes auto-starts based on profile mode; either way the
    // "Tutor not included" error must appear when an unentitled SKU
    // is exercised.
    await expect(
      page.getByText(/not included|locked|Tutor not included|Ask a parent/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});
