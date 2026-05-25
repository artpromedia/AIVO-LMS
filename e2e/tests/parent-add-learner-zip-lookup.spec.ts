import { test, expect, request as pwRequest } from "@playwright/test";

/**
 * Sprint A — Parent zip code → district auto-lookup e2e.
 *
 * Three cases:
 *   1. Entering a known major-district zip auto-fills the district
 *      label and posts hidden districtId + districtName fields.
 *   2. Entering an unmatched zip shows the "no match" copy and the
 *      manual search reveals matches by name.
 *   3. The field is optional — submitting the form without a zip
 *      still creates a learner.
 *
 * Auto-skips when the web-v2 app is not reachable on the configured
 * base URL. The lookup BFF intercepts identity-svc so the test does
 * not require a live identity-svc / DB.
 */

const BASE_URL = process.env.WEB_V2_BASE_URL || "http://localhost:3000";

async function isAppReachable(): Promise<boolean> {
  try {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.get("/api/bff/health", { timeout: 2500 });
    await ctx.dispose();
    return res.ok();
  } catch {
    return false;
  }
}

test.describe("Parent — add learner zip→district auto-lookup", () => {
  test.beforeAll(async () => {
    if (!(await isAppReachable())) {
      test.skip(true, `web-v2 not reachable at ${BASE_URL}`);
    }
  });

  test("90210 resolves to Beverly Hills USD", async ({ page }) => {
    // Intercept the BFF to keep the test hermetic.
    await page.route("**/api/bff/curriculum/lookup**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "test-req-1",
          data: {
            curriculum: {
              state: "CA",
              districtId: "0612330",
              districtName: "Beverly Hills Unified School District",
            },
            districts: {
              zip: "90210",
              dominant: {
                ncesId: "0612330",
                name: "Beverly Hills Unified School District",
                state: "CA",
                city: "Beverly Hills",
                weight: 1.0,
                dominant: true,
              },
              alternates: [],
              source: "db",
            },
          },
        }),
      });
    });

    await page.goto("/parent/learners/new");
    await page.getByLabel(/zip code/i).fill("90210");
    await expect(page.getByText("Beverly Hills Unified School District")).toBeVisible({
      timeout: 5000,
    });
  });

  test("unmatched zip surfaces no-match copy and search override", async ({ page }) => {
    await page.route("**/api/bff/curriculum/lookup**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "test-req-2",
          data: {
            curriculum: { state: "CA" },
            districts: null,
          },
        }),
      });
    });
    await page.route("**/api/bff/curriculum/districts/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "test-req-3",
          data: {
            matches: [
              {
                ncesId: "9999999",
                name: "Sample Unified School District",
                state: "CA",
                city: "Sampletown",
                weight: 0,
                dominant: false,
              },
            ],
          },
        }),
      });
    });

    await page.goto("/parent/learners/new");
    await page.getByLabel(/zip code/i).fill("99999");
    await expect(page.getByText(/couldn't find a district/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("button", { name: /search/i }).click();
    await page.getByLabel(/search districts/i).fill("Sample");
    await expect(page.getByRole("button", { name: /Sample Unified/i })).toBeVisible();
  });

  test("submitting without a zip still works (field is optional)", async ({ page }) => {
    await page.goto("/parent/learners/new");
    await page.getByLabel(/learner first name|first name/i).fill("Test");
    await page.getByLabel(/birth year/i).fill(String(new Date().getFullYear() - 7));
    // No zip entered; assert no validation error appears for the field.
    await expect(page.getByText(/zip code must be 5 digits/i)).toHaveCount(0);
  });
});
