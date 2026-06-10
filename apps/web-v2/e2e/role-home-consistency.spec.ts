import { expect, test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROLE_SURFACES = [
  { mockSession: "learner", route: "/learner/home" },
  { mockSession: "parent", route: "/parent/reports" },
  { mockSession: "teacher", route: "/teacher/home" },
  { mockSession: "therapist", route: "/therapist/home" },
  { mockSession: "caregiver", route: "/caregiver/home" },
] as const;

const ROLE_HOME_FILES = [
  "app/learner/home/page.tsx",
  "app/parent/reports/page.tsx",
  "app/teacher/home/page.tsx",
  "app/therapist/home/page.tsx",
  "app/caregiver/home/page.tsx",
] as const;

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y role home consistency", () => {
  for (const surface of ROLE_SURFACES) {
    test(`@a11y ${surface.route} uses scaffold structure`, async ({ context, page }) => {
      await context.addCookies([
        {
          name: "aivo_mock_session",
          value: surface.mockSession,
          domain: "127.0.0.1",
          path: "/",
        },
      ]);

      await page.goto(surface.route);
      await page.waitForSelector("main", { timeout: 30_000 });

      if (surface.route === "/learner/home" && page.url().includes("/login")) {
        await expect(page.getByRole("heading", { name: /continue with your aivo account/i })).toBeVisible();
        return;
      }

      await expect(page.getByTestId("role-home-hero")).toBeVisible();
      await expect(page.getByTestId("role-home-kpi-strip")).toBeVisible();
      await expect(page.getByTestId("role-home-section").first()).toBeVisible();

      await injectAxe(page);
      await checkA11y(page, "main", {
        detailedReport: true,
        detailedReportOptions: { html: true },
        axeOptions: { rules: AXE_RULES },
      });
    });
  }

  test("@a11y role home source uses shared icons", async () => {
    for (const relativeFile of ROLE_HOME_FILES) {
      const source = await readFile(path.join(process.cwd(), relativeFile), "utf8");
      expect(source).not.toMatch(/<svg[\s>]/);
    }
  });
});
