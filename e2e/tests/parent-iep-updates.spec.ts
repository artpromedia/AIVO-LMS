import { test, expect, type APIRequestContext } from "@playwright/test";
import { seedOrThrow } from "./sprint12/_seed";

/**
 * Sprint — Phase D coverage for the parent IEP "Updates" timeline UI.
 *
 * This spec exercises two contracts that were previously only validated
 * manually / at the API layer:
 *
 *   1. The parent-facing Updates tab calls
 *      GET /api/iep/learners/:learnerId/timeline with the right learner id
 *      and surfaces only parent-visibility items (parent notes show up,
 *      internal-only notes do NOT bleed through to the family).
 *
 *   2. A teacher signed in to a *different* tenant cannot read another
 *      tenant's learner timeline through the same endpoint — the request
 *      is rejected (403) instead of silently leaking notes across
 *      organisations.
 *
 * The fixtures (parent + child + finalised IEP + parent/internal notes
 * + cross-tenant teacher) are seeded through identity-svc's
 * IDENTITY_TEST_MODE-only helper so the spec doesn't need a manually
 * curated database. When that helper isn't reachable (test mode off /
 * identity-svc not up), the suite auto-skips so it stays green outside
 * configured CI.
 */

const IDENTITY_BASE = process.env.IDENTITY_BASE_URL || "http://localhost:3001";

const PARENT_EMAIL = process.env.E2E_IEP_PARENT_EMAIL || "e2e-iep-parent@example.test";
const PARENT_PASSWORD = process.env.E2E_IEP_PARENT_PASSWORD || "E2eParent!Pass1";
const TEACHER_EMAIL =
  process.env.E2E_IEP_TEACHER_EMAIL || "e2e-iep-cross-tenant-teacher@example.test";
const TEACHER_PASSWORD = process.env.E2E_IEP_TEACHER_PASSWORD || "E2eTeacher!Pass1";

const PARENT_NOTE = "PARENT_VISIBLE_NOTE_BODY: timeline e2e parent-visible";
const INTERNAL_NOTE = "INTERNAL_ONLY_NOTE_BODY: timeline e2e internal-only";

interface SeedResult {
  parent: { id: string; email: string; tenantId: string };
  teacher: { id: string; email: string; tenantId: string };
  learner: { id: string; name: string; tenantId: string };
  iepProfileId: string;
  notes: { parentNoteId: string; internalNoteId: string };
  bodies: { parent: string; internal: string };
  // Populated only when the seeder is asked to insert an unread in-app
  // notification — used by the global bell badge spec.
  inAppNotificationId?: string | null;
  inAppTitle?: string | null;
}

interface TimelineNotePayload {
  body?: string;
  visibility?: string;
}

interface TimelineItem {
  type: "note" | "report" | "amendment" | "reminder";
  id: string;
  at: string;
  payload: TimelineNotePayload & Record<string, unknown>;
}

interface TimelineResponse {
  iepProfileId: string | null;
  items?: TimelineItem[];
}

// Sprint 12.6 — assigned in beforeAll(); trySeed() now throws on failure
// so we'll never read this as null at runtime, but the type still
// reflects the pre-beforeAll state to keep strict-mode happy.
let seed: SeedResult | null = null;

// Sprint 12.6 — throws on seed failure instead of silently returning null.
async function trySeed(opts: { withInApp?: boolean } = {}): Promise<SeedResult> {
  return seedOrThrow<SeedResult>({
    role: opts.withInApp ? "IEP_TIMELINE_INAPP" : "IEP_TIMELINE",
    identityBaseUrl: IDENTITY_BASE,
    endpoint: "/api/__test__/seed-iep-timeline-fixture",
    body: {
      parentEmail: PARENT_EMAIL,
      parentPassword: PARENT_PASSWORD,
      teacherEmail: TEACHER_EMAIL,
      teacherPassword: TEACHER_PASSWORD,
      parentNoteBody: PARENT_NOTE,
      internalNoteBody: INTERNAL_NOTE,
      seedInAppUnread: !!opts.withInApp,
    },
  });
}

async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post(`/api/auth/login`, {
    data: { email, password },
    failOnStatusCode: false,
  });
  expect(res.status(), `login as ${email}`).toBe(200);
  const body = await res.json();
  expect(body.mfaPending, `${email} should not require MFA in this fixture`).toBeFalsy();
  expect(body.accessToken, `accessToken issued for ${email}`).toBeTruthy();
  expect(body.user?.id, "user payload returned").toBeTruthy();
  return body.accessToken as string;
}

test.describe("parent IEP Updates timeline — UI + cross-tenant safety", () => {
  test.beforeAll(async () => {
    // Sprint 12.6 — throws on failure; the silent skip path was removed.
    seed = await trySeed();
  });

  test("parent sees only parent-visibility items on the Updates tab", async ({ page, context }) => {
    const fixture = seed!;

    // Sign in via the public login endpoint — this drops the httpOnly
    // refreshToken cookie into the browser context. The SPA's auth
    // provider then bootstraps an accessToken on first render via
    // /api/auth/refresh, so we don't need to inject anything client-side.
    await loginViaApi(context.request, PARENT_EMAIL, PARENT_PASSWORD);

    // Capture the timeline request the page makes so we can both wait on
    // it AND inspect the URL — that is exactly the regression vector
    // (UI calling the endpoint with the wrong learner id) we want to
    // catch.
    const timelinePromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/iep/learners/${fixture.learner.id}/timeline`) &&
        r.request().method() === "GET" &&
        r.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto(`/dashboard/parent/learner/${fixture.learner.id}/iep`);
    const timelineResp = await timelinePromise;

    // The endpoint URL must contain the parent's own learner id, not any
    // other id from the device's tab/session history.
    expect(timelineResp.url()).toContain(`/learners/${fixture.learner.id}/timeline`);
    const json = (await timelineResp.json()) as TimelineResponse;
    expect(json.iepProfileId, "active IEP profile resolved").toBe(fixture.iepProfileId);
    const items: TimelineItem[] = Array.isArray(json.items) ? json.items : [];
    const noteBodies: string[] = items
      .filter((i) => i.type === "note")
      .map((i) => String(i.payload?.body ?? ""));
    expect(noteBodies, "parent timeline contains the parent-visible note").toContain(PARENT_NOTE);
    expect(
      noteBodies.some((b) => b.includes(INTERNAL_NOTE)),
      "internal-only note must NOT leak to the parent payload",
    ).toBe(false);

    // Also assert the rendered DOM shows the parent note and does not
    // include the internal one — guards against a regression where the
    // hook fetches correctly but the component wires the wrong field.
    await expect(page.getByText(PARENT_NOTE, { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(INTERNAL_NOTE, { exact: false })).toHaveCount(0);
  });

  test("teacher in a different tenant cannot reach another tenant's parent IEP page or timeline", async ({
    page,
    context,
  }) => {
    const fixture = seed!;

    // Sign the teacher in (drops a refreshToken cookie + returns the
    // bearer access token).
    const accessToken = await loginViaApi(context.request, TEACHER_EMAIL, TEACHER_PASSWORD);

    // Capture every timeline request the page issues so we can prove
    // the UI either never asks for the other tenant's learner OR is
    // refused if it does.
    const timelineCalls: { url: string; status: number; body: string }[] = [];
    page.on("response", async (resp) => {
      if (resp.url().includes(`/api/iep/learners/`) && resp.url().includes("/timeline")) {
        let body = "";
        try {
          body = await resp.text();
        } catch {
          /* noop */
        }
        timelineCalls.push({ url: resp.url(), status: resp.status(), body });
      }
    });

    // Browser-level attempt to view another tenant's parent IEP page.
    // The parent-dashboard layout enforces role === "PARENT" and
    // redirects everyone else away to "/". This is the user-facing
    // contract that prevents a teacher with a stolen URL on a shared
    // device from rendering another family's Updates tab.
    await page.goto(`/dashboard/parent/learner/${fixture.learner.id}/iep`);
    await page.waitForURL((u) => !u.pathname.startsWith("/dashboard/parent/learner/"), {
      timeout: 10_000,
    });
    expect(page.url(), "teacher must be routed off the parent IEP page").not.toContain(
      `/dashboard/parent/learner/${fixture.learner.id}`,
    );
    // Whatever the page renders, none of the seeded notes can be visible
    // to a user from a different tenant.
    await expect(page.getByText(PARENT_NOTE, { exact: false })).toHaveCount(0);
    await expect(page.getByText(INTERNAL_NOTE, { exact: false })).toHaveCount(0);

    // If the page (or any code on it) still attempted the timeline call,
    // every such call must be rejected — never a 200 leaking items.
    for (const call of timelineCalls) {
      expect(call.status, `timeline call ${call.url} must be denied`).not.toBe(200);
    }

    // Direct API check using the teacher's bearer token — the same vector
    // a buggy hook could exploit. Asserts the endpoint itself rejects
    // cross-tenant reads (defense-in-depth alongside the UI assertion
    // above).
    const denied = await page.request.get(`/api/iep/learners/${fixture.learner.id}/timeline`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      failOnStatusCode: false,
    });
    // Authenticated teacher should hit the tenant-isolation branch
    // specifically (403), not generic auth failure (401). 401 here would
    // indicate the bearer token broke for unrelated reasons and would
    // mask a real cross-tenant regression.
    expect(denied.status(), "cross-tenant teacher must get an authenticated 403").toBe(403);
    const deniedText = await denied.text();
    expect(deniedText, "denied response must not echo seeded note bodies").not.toContain(
      PARENT_NOTE,
    );
    expect(deniedText, "denied response must not echo internal note bodies").not.toContain(
      INTERNAL_NOTE,
    );
  });
});

// Sprint 3 task #18: the parent dashboard header bell aggregates the
// merged inbox feed (legacy parent_notifications + IEP
// parent_in_app_notifications). When the IEP pipeline creates a row, the
// bell badge must reflect it on every page of the parent dashboard, not
// just inside the per-learner Updates tab.
test.describe("parent dashboard global bell — IEP in-app notifications surface in the header", () => {
  // Sprint 12.6 — same pattern as `seed` above: assigned in beforeAll
  // via a throw-on-failure helper, typed `| null` for strict-mode init.
  let bellSeed: SeedResult | null = null;

  test.beforeAll(async () => {
    // Sprint 12.6 — throws on failure. The in-app variant additionally
    // requires the server-side fixture to return a non-null
    // inAppNotificationId; we surface that as a loud Error so a half-
    // wired seed endpoint never silently green-passes the build.
    bellSeed = await trySeed({ withInApp: true });
    if (!bellSeed!.inAppNotificationId) {
      throw new Error(
        "Sprint12 seed failed for role=IEP_TIMELINE_INAPP: " +
          "seed-iep-timeline-fixture returned no inAppNotificationId. " +
          "Verify seedInAppUnread support is wired in identity-svc.",
      );
    }
  });

  test("the bell badge picks up an unread IEP in-app notification on the dashboard home", async ({
    page,
    context,
  }) => {
    const fixture = bellSeed!;
    await loginViaApi(context.request, PARENT_EMAIL, PARENT_PASSWORD);

    // Wait for the layout's merged-inbox unread call so we can inspect
    // the count the bell receives.
    const inboxPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/family/inbox/${fixture.parent.id}`) &&
        r.url().includes("filter=unread") &&
        r.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto(`/dashboard/parent`);
    const inboxResp = await inboxPromise;
    const inboxJson = await inboxResp.json();
    expect(typeof inboxJson.unreadCount).toBe("number");
    expect(
      inboxJson.unreadCount,
      "merged unread count includes the IEP in-app row",
    ).toBeGreaterThanOrEqual(1);

    // The header bell renders a numeric badge when unreadCount > 0. We
    // can't rely on the icon alone (it's an SVG without text) — instead
    // assert the aria-label which the layout sets when there are unread
    // items.
    const bell = page.getByRole("link", { name: /Inbox.*unread/ });
    await expect(bell).toBeVisible({ timeout: 10_000 });
  });

  test("the inbox page shows the IEP in-app notification with a link back to the learner's Updates tab", async ({
    page,
    context,
  }) => {
    const fixture = bellSeed!;
    await loginViaApi(context.request, PARENT_EMAIL, PARENT_PASSWORD);

    const inboxPromise = page.waitForResponse(
      (r) => r.url().endsWith(`/api/family/inbox/${fixture.parent.id}`) && r.status() === 200,
      { timeout: 15_000 },
    );
    await page.goto(`/dashboard/parent/inbox`);
    const inboxResp = await inboxPromise;
    const json = await inboxResp.json();
    const items = (json.items || []) as Array<{
      source?: string;
      learnerId?: string;
      actionUrl?: string;
      title?: string;
    }>;
    const iep = items.find((i) => i.source === "iep");
    expect(iep, "merged inbox feed must include an IEP-source row").toBeTruthy();
    expect(iep!.learnerId).toBe(fixture.learner.id);
    expect(iep!.actionUrl).toContain(`/dashboard/parent/learner/${fixture.learner.id}/iep`);
    if (fixture.inAppTitle) {
      await expect(page.getByText(fixture.inAppTitle, { exact: false })).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
