/**
 * Phase 5 — Per-role accessibility coverage.
 *
 * ADR 0020 Phase 5 ("Accessibility") requires the `test:a11y`
 * Playwright suite to run against every role segment so a regression
 * in one role's shell (e.g. a missing landmark on `/therapist/home`)
 * is caught before release, not after.
 *
 * The mock session is selected via the `aivo_mock_session` cookie that
 * `apps/web-v2/lib/auth/mock-session.ts` reads. We exercise the home
 * route of each role on the web shell because that page composes the
 * sidebar, the role switcher, and the role-specific dashboard cards —
 * the three places where an accessibility regression is most likely to
 * surface.
 *
 * Each case is tagged `@a11y` so it is picked up by
 * `pnpm test:a11y` (which greps for that tag) and skipped from the
 * smoke run that does not need the axe ceremony.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

type RoleCase = {
  mockSession: string;
  label: string;
  homeRoute: string;
};

// Mirrors `ROLE_HOME` in `apps/web-v2/lib/auth/types.ts`. Kept inline
// so the Playwright spec stays free of `@/lib` aliasing (the playwright
// runner does not honor the Next.js tsconfig paths config).
const ROLE_HOMES: RoleCase[] = [
  { mockSession: "learner", label: "learner", homeRoute: "/learner/home" },
  { mockSession: "parent", label: "parent", homeRoute: "/parent/home" },
  { mockSession: "teacher", label: "teacher", homeRoute: "/teacher/home" },
  { mockSession: "caregiver", label: "caregiver", homeRoute: "/caregiver/home" },
  { mockSession: "therapist", label: "therapist", homeRoute: "/therapist/home" },
  { mockSession: "school_admin", label: "school admin", homeRoute: "/admin/school" },
  { mockSession: "district_admin", label: "district admin", homeRoute: "/admin/district" },
  { mockSession: "platform_admin", label: "platform admin", homeRoute: "/admin/platform" },
];

// Disabled axe rules — these match the existing `visual-a11y` spec so
// the per-role suite does not flag baseline pages that would not be
// flagged today. Anything more aggressive belongs in a separate ratchet.
const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

test.describe("@a11y per-role home routes", () => {
  for (const role of ROLE_HOMES) {
    test(`@a11y ${role.label} home (${role.homeRoute})`, async ({ context, page }) => {
      await context.addCookies([
        {
          name: "aivo_mock_session",
          value: role.mockSession,
          domain: "127.0.0.1",
          path: "/",
        },
      ]);
      await page.goto(role.homeRoute);
      // Wait for the shell to mount its primary content region before
      // running axe so we are not racing the React hydration boundary.
      await page.waitForSelector("main", { timeout: 30_000 });
      await injectAxe(page);
      await checkA11y(page, "main", {
        detailedReport: true,
        detailedReportOptions: { html: true },
        axeOptions: { rules: AXE_RULES },
      });
      // Sanity assertion so a 200-with-blank-body regression is caught
      // even when axe reports no violations against an empty region.
      await expect(page.locator("main")).toBeVisible();
    });
  }
});
