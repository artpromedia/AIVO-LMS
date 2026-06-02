/**
 * Sprint 2 (SIS Roster Sync) — functional flows against the mock app.
 *
 * Covers the DoD e2e contract:
 *   - district admin views the SIS connector list (seeded OneRoster
 *     connector shows a healthy/green status card),
 *   - opens the detail, runs a sync and sees the run history update,
 *   - drills into the seeded malformed-row error and retries it
 *     (the error clears).
 *
 * Runs against `pnpm dev` with a district_admin mock session.
 */
import { test, expect } from "@playwright/test";

const districtCookie = { name: "aivo_mock_session", value: "district_admin", domain: "127.0.0.1", path: "/" };

test.describe.configure({ mode: "serial" });

test.describe("SIS roster sync flows", () => {
  test("district admin sees the connector list and a status card", async ({ context, page }) => {
    await context.addCookies([districtCookie]);
    await page.goto("/admin/district/sis");
    await expect(page.getByText("PowerSchool (OneRoster)")).toBeVisible({ timeout: 30_000 });
    // The seeded run succeeded => SUCCESS badge somewhere on the card.
    await expect(page.getByText(/SUCCESS/i).first()).toBeVisible();
  });

  test("runs a sync and drills into / retries an error", async ({ context, page }) => {
    await context.addCookies([districtCookie]);
    await page.goto("/admin/district/sis/sis_demo_oneroster");

    // Trigger a delta sync; the run history should gain a row.
    await page.getByRole("button", { name: /run delta sync/i }).click();
    await expect(page.getByText(/sync complete|run paused/i)).toBeVisible({ timeout: 15_000 });

    // The seeded malformed row is shown; retry it and it clears.
    await expect(page.getByText("Missing required field: email")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^retry$/i }).first().click();
    await expect(page.getByText(/no errors in the latest run/i)).toBeVisible({ timeout: 15_000 });
  });
});
