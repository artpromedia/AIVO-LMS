import { test, expect } from "@playwright/test";

/**
 * Sprint 7 — Daily Batch admin page e2e. (Tasks #61, #71, #73)
 *
 * Mocks `/api/billing/admin/daily-jobs/status` and asserts the filter UI
 * reaches the API with the expected query string and that filter selections
 * persist across reloads.
 */

const ADMIN_AUTH = {
  accessToken: "admin-token",
  user: { id: "admin-1", role: "PLATFORM_ADMIN", tenantId: null, email: "a@aivo.dev", name: "Admin" },
};

test.describe("Daily Batch admin page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((auth) => {
      window.localStorage.setItem("aivo.auth", JSON.stringify(auth));
      window.localStorage.setItem("accessToken", "admin-token");
    }, ADMIN_AUTH);

    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ADMIN_AUTH.user),
      }),
    );
  });

  test("renders the latest tick + history rows", async ({ page }) => {
    await page.route("**/api/billing/admin/daily-jobs/status**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          latest: {
            jobName: "billing.daily-expiry-reminders",
            lastRunAt: new Date().toISOString(),
            lastFinishedAt: new Date().toISOString(),
            lastReplicaId: "r1",
            lastStatus: "ok",
            lastSent: 12,
            lastFailed: 0,
            lastError: null,
          },
          filters: { statuses: null, since: null, until: null, limit: 30 },
          history: [
            { id: 1, runAt: new Date().toISOString(), finishedAt: null, replicaId: "r1", status: "ok", sent: 12, failed: 0, durationMs: 200, error: null },
          ],
        }),
      }),
    );
    await page.goto("/dashboard/admin/billing/daily-batch");
    await expect(page.getByTestId("recent-runs-table")).toBeVisible();
  });

  test("status filter forwards to the API and persists", async ({ page }) => {
    let lastRequestUrl = "";
    await page.route("**/api/billing/admin/daily-jobs/status**", (route, request) => {
      lastRequestUrl = request.url();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ latest: null, filters: { statuses: null, since: null, until: null, limit: 30 }, history: [] }),
      });
    });
    await page.goto("/dashboard/admin/billing/daily-batch");
    await page.getByLabel("failed").check();
    await page.waitForFunction(() => true, undefined, { timeout: 1500 }).catch(() => {});
    expect(lastRequestUrl).toContain("status=failed");
    // Reload and confirm the checkbox is still set.
    await page.reload();
    await expect(page.getByLabel("failed")).toBeChecked();
  });
});
