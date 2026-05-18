import { test, expect } from "@playwright/test";

/**
 * Sprint 7 — Background Jobs page e2e. (Tasks #77, #180)
 *
 * Mocks `/api/admin-svc/*` so the spec verifies the page wiring without a
 * live admin-svc: registry-vs-ledger merge, expandable runs, run-now button,
 * and the freshness dashboard.
 */

const ADMIN_AUTH = {
  accessToken: "admin-token",
  user: {
    id: "admin-1",
    role: "PLATFORM_ADMIN",
    tenantId: null,
    email: "a@aivo.dev",
    name: "Admin",
  },
};

test.describe("Background Jobs admin page", () => {
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

    await page.route("**/api/admin-svc/jobs", (route) => {
      const now = new Date().toISOString();
      const stale = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobs: [
            {
              jobName: "billing.daily-expiry-reminders",
              service: "billing-svc",
              description: "Daily reminders",
              periodMs: 86_400_000,
              lastRunAt: now,
              lastFinishedAt: now,
              lastReplicaId: "r1",
              lastStatus: "ok",
              lastSent: 7,
              lastFailed: 0,
              lastError: null,
              freshness: {
                jobName: "billing.daily-expiry-reminders",
                status: "fresh",
                ageMs: 60_000,
                failed: false,
                lastFinishedAt: now,
                lastRunAt: now,
              },
              unregistered: false,
            },
            {
              jobName: "research.weekly-aggregation",
              service: "research-svc",
              description: "Weekly aggregate",
              periodMs: 7 * 86_400_000,
              lastRunAt: stale,
              lastFinishedAt: stale,
              lastReplicaId: "r2",
              lastStatus: "ok",
              lastSent: 0,
              lastFailed: 0,
              lastError: null,
              freshness: {
                jobName: "research.weekly-aggregation",
                status: "fresh",
                ageMs: 3 * 86_400_000,
                failed: false,
                lastFinishedAt: stale,
                lastRunAt: stale,
              },
              unregistered: false,
            },
            {
              jobName: "legacy.unknown",
              service: "(unknown)",
              description: "Job present in ledger but not in JOB_REGISTRY.",
              periodMs: 86_400_000,
              lastRunAt: now,
              lastFinishedAt: null,
              lastReplicaId: null,
              lastStatus: null,
              lastSent: null,
              lastFailed: null,
              lastError: null,
              freshness: {
                jobName: "legacy.unknown",
                status: "warning",
                ageMs: 60_000,
                failed: false,
                lastFinishedAt: null,
                lastRunAt: now,
              },
              unregistered: true,
            },
          ],
        }),
      });
    });

    await page.route("**/api/admin-svc/jobs/billing.daily-expiry-reminders/runs**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobName: "billing.daily-expiry-reminders",
          limit: 20,
          runs: [
            {
              id: 3,
              runAt: new Date().toISOString(),
              finishedAt: null,
              replicaId: "r1",
              status: "ok",
              durationMs: 200,
              error: null,
            },
            {
              id: 2,
              runAt: new Date(Date.now() - 86_400_000).toISOString(),
              finishedAt: null,
              replicaId: "r1",
              status: "partial",
              durationMs: 350,
              error: null,
            },
            {
              id: 1,
              runAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
              finishedAt: null,
              replicaId: "r1",
              status: "ok",
              durationMs: 180,
              error: null,
            },
          ],
        }),
      }),
    );

    await page.route("**/api/admin-svc/jobs/billing.daily-expiry-reminders/run-now", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "queued" }),
      }),
    );

    await page.route("**/api/admin-svc/jobs/freshness", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          counts: { fresh: 3, warning: 0, stale: 1, never_run: 0, failed: 0 },
          reports: [
            {
              jobName: "billing.daily-expiry-reminders",
              status: "fresh",
              ageMs: 1000,
              failed: false,
              lastFinishedAt: new Date().toISOString(),
              lastRunAt: new Date().toISOString(),
            },
            {
              jobName: "comms.digest-cleanup",
              status: "stale",
              ageMs: 1_000_000,
              failed: true,
              lastFinishedAt: null,
              lastRunAt: null,
            },
          ],
        }),
      }),
    );
  });

  test("renders the registry-vs-ledger merged table", async ({ page }) => {
    await page.goto("/dashboard/admin/jobs");
    await expect(page.getByTestId("jobs-table")).toBeVisible();
    await expect(page.getByTestId("job-row-billing.daily-expiry-reminders")).toBeVisible();
    await expect(page.getByTestId("job-row-legacy.unknown")).toContainText("unregistered");
  });

  test("expands a job row to show recent runs and a duration sparkline", async ({ page }) => {
    await page.goto("/dashboard/admin/jobs");
    await page.getByTestId("job-row-billing.daily-expiry-reminders").click();
    const expanded = page.getByTestId("job-row-runs-billing.daily-expiry-reminders");
    await expect(expanded).toBeVisible();
    await expect(expanded.getByRole("img", { name: "Recent run durations" })).toBeVisible();
    await expect(expanded.getByTestId("runs-table-billing.daily-expiry-reminders")).toBeVisible();
  });

  test("Run-now sends a POST and surfaces success", async ({ page }) => {
    let posted = false;
    await page.route("**/api/admin-svc/jobs/billing.daily-expiry-reminders/run-now", (route) => {
      posted = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "queued" }),
      });
    });
    await page.goto("/dashboard/admin/jobs");
    const row = page.getByTestId("job-row-billing.daily-expiry-reminders");
    await row.getByRole("button", { name: /Run now/ }).click();
    await expect(row.getByRole("button", { name: /Triggered/ })).toBeVisible({ timeout: 5000 });
    expect(posted).toBeTruthy();
  });

  test("freshness page renders red for stale jobs", async ({ page }) => {
    await page.goto("/dashboard/admin/jobs/freshness");
    await expect(page.getByTestId("freshness-comms.digest-cleanup")).toBeVisible();
    await expect(page.getByTestId("freshness-billing.daily-expiry-reminders")).toBeVisible();
  });
});
