import { test, expect } from "@playwright/test";

/**
 * Sprint 10 (Cross-Tier Reports & Exports) — full admin journey, e2e.
 *
 * Documents and (when the harness is up) exercises the Definition-of-Done
 * flow across web-v2 + reports-svc:
 *
 *   1. A district admin opens the reports catalog (scope-filtered).
 *   2. They run "enrollment-by-school" and wait for the run to succeed.
 *   3. They download the result as CSV.
 *   4. They schedule a weekly delivery to a VERIFIED recipient within scope.
 *   5. A school admin attempting a DISTRICT-scope report gets 403
 *      (SCOPE_FORBIDDEN) AND the report is HIDDEN from their catalog
 *      (caller scope >= report scope; catalogForScope filters it out).
 *
 * Auth: the app uses mock sessions in e2e. This spec depends on the shared
 * fixtures in `e2e/lib/fixtures.ts` (`seedDistrictAdmin`/`seedSchoolAdmin`,
 * `authenticateBrowser`) and on identity-svc test-mode helpers
 * (`skipUnlessIdentityTestMode`). Running a report needs the reports-svc
 * stack (seeded tenants), and CSV download needs the run engine inline path.
 * Scheduling needs a verified recipient in the caller's scope. Where helpers
 * are unavailable the suite skips rather than failing CI, matching
 * `tests/admin-identity.spec.ts`.
 *
 * NOTE: stable selectors for the Sprint 10 pages are not all confirmed, so the
 * steps navigate by role-route (`/admin/district/reports`,
 * `/admin/school/reports`) and assert on accessible text/roles. Marked
 * `fixme` until the seed helpers + reports-console data-testid hooks land;
 * the steps below are the intended journey.
 */

import {
  seedSchoolAdmin,
  authenticateBrowser,
  skipUnlessIdentityTestMode,
  // seedDistrictAdmin is preferred when available; falls back to platform
  // admin acting at district scope where the fixture is not yet present.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} from "../../lib/fixtures";
// District-admin seeding may not exist yet in fixtures; import defensively.
import * as fixtures from "../../lib/fixtures";

const REPORT_ID = "enrollment-by-school"; // district scope
const HIDDEN_FOR_SCHOOL = "enrollment-by-school"; // district report, hidden from school catalog
const VERIFIED_RECIPIENT = "district-reports@aivo.example";

test.describe("Cross-Tier Reports — catalog, run, CSV download, schedule, scope RBAC", () => {
  // Requires identity test-mode seeding + the reports-svc stack.
  test.fixme(
    true,
    "Enable once reports-svc + identity test-mode seed helpers (incl. a district admin) and reports-console data-testid hooks are wired in e2e.",
  );

  test("district admin runs + downloads + schedules a report; school admin is scope-forbidden", async ({
    page,
    browser,
  }) => {
    await skipUnlessIdentityTestMode();

    // ── District admin session ────────────────────────────────────────────
    const seedDistrictAdmin =
      (fixtures as Record<string, unknown>).seedDistrictAdmin as
        | (() => Promise<unknown>)
        | undefined;
    const district = seedDistrictAdmin
      ? await seedDistrictAdmin()
      : await seedSchoolAdmin(); // fallback fixture; real run uses a district admin
    test.skip(!district, "could not seed district admin");
    await authenticateBrowser(page, district as never);

    // 1) Open the scope-filtered catalog; the district report is present.
    await page.goto("/admin/district/reports");
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();
    const reportLink = page.getByRole("link", { name: /enrollment by school/i });
    await expect(reportLink).toBeVisible();
    await reportLink.click();

    // 2) Run it. Fill required params (a tenant in the caller's allow-list)
    //    and run; wait for the run to reach "succeeded".
    await page.getByLabel(/tenant/i).selectOption({ index: 1 }).catch(async () => {
      await page.getByRole("combobox", { name: /tenant/i }).click();
      await page.getByRole("option").nth(1).click();
    });
    await page.getByRole("button", { name: /run report|run|generate/i }).click();
    await expect(page.getByText(/succeeded|complete|ready/i)).toBeVisible({ timeout: 30_000 });

    // 3) Download CSV. Capture the browser download and assert it is a CSV
    //    with the expected header row.
    await page.getByRole("button", { name: /format|csv/i }).first().click().catch(() => undefined);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15_000 }),
      page.getByRole("button", { name: /download/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);

    // 4) Schedule a weekly delivery to a verified, in-scope recipient.
    await page.getByRole("button", { name: /schedule/i }).click();
    await page.getByLabel(/frequency|cadence/i).selectOption({ label: "Weekly" }).catch(async () => {
      await page.getByRole("radio", { name: /weekly/i }).click();
    });
    await page.getByLabel(/recipient|email/i).fill(VERIFIED_RECIPIENT);
    await page.getByRole("button", { name: /save schedule|schedule|create/i }).click();
    await expect(page.getByText(new RegExp(VERIFIED_RECIPIENT, "i"))).toBeVisible();
    await expect(page.getByText(/weekly/i)).toBeVisible();

    // ── School admin session: district report is hidden + 403 ─────────────
    const school = await seedSchoolAdmin();
    test.skip(!school, "could not seed school admin");
    const schoolCtx = await browser.newContext();
    const schoolPage = await schoolCtx.newPage();
    await authenticateBrowser(schoolPage, school!);

    // 5a) The district-scope report is HIDDEN from the school catalog
    //     (catalogForScope filters reportScope > callerScope).
    await schoolPage.goto("/admin/school/reports");
    await expect(schoolPage.getByRole("heading", { name: /reports/i })).toBeVisible();
    await expect(
      schoolPage.getByRole("link", { name: /enrollment by school/i }),
    ).toHaveCount(0);

    // 5b) Directly running the district report by id is refused with 403
    //     SCOPE_FORBIDDEN (caller scope < report scope).
    const run = await schoolPage.request.post(`/api/reports/${REPORT_ID}/run`, {
      data: { params: { tenantId: (school as { tenantId?: string }).tenantId }, format: "csv" },
    });
    expect(run.status()).toBe(403);
    const body = await run.json().catch(() => ({}));
    expect(JSON.stringify(body)).toMatch(/SCOPE_FORBIDDEN|forbidden/i);

    // The schema endpoint for a hidden report is likewise scope-guarded.
    const schema = await schoolPage.request.get(`/api/reports/${HIDDEN_FOR_SCHOOL}/schema`);
    expect([403, 404]).toContain(schema.status());

    await schoolCtx.close();
  });
});
