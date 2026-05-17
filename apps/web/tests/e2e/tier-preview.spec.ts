import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Phase 5 smoke spec: tier preview surfaces.
 *
 * The `/showcase/tiers/preview` route renders representative chrome
 * (assessment intro + lesson-stage card) inside each of the three
 * `<TierThemeProvider>` wrappers. We assert:
 *
 *   1. The route loads unauthenticated (it's the public showcase).
 *   2. Each tier label is rendered, so the provider wiring isn't broken.
 *   3. axe-core finds zero violations of the WCAG 2.1 A/AA rule pack.
 *
 * Visual-regression snapshots are deliberately deferred — Playwright's
 * baseline screenshots need to be captured in CI's exact runner image
 * to avoid sub-pixel font-render diffs from blocking PRs. Tracked as a
 * follow-up in the PR description.
 */

const TIER_LABELS = [
  "K–5 · Soft Meadow",
  "6–8 · Study Treehouse",
  "9–12 · Focus Studio",
];

test.describe("tier preview showcase", () => {
  test("all three tiers render unauthenticated", async ({ page }) => {
    await page.goto("/showcase/tiers/preview");

    // Page-title heading acts as a synchronous readiness signal — once
    // it's visible we know hydration ran and the tier providers mounted.
    // 15s timeout is intentional: this spec runs against the dev server
    // (Turbopack first-load can take ~5–10s in CI runners), so a shorter
    // bound would flake before the page is genuinely broken.
    await expect(
      page.getByRole("heading", { name: /three age tiers/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    for (const label of TIER_LABELS) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test("axe-core: no WCAG A/AA violations across all three tiers", async ({ page }) => {
    await page.goto("/showcase/tiers/preview");
    await page.waitForLoadState("networkidle");

    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // The showcase intentionally uses decorative blur halos with hex
      // literals — they're aria-hidden, but `color-contrast` can still
      // mis-flag them. Disable just that single rule for this smoke
      // spec; per-tier contrast is exercised by the brand audit suite.
      .disableRules(["color-contrast"])
      .analyze();

    expect(
      axeResults.violations,
      `Axe violations:\n${axeResults.violations.map((v) => `- ${v.id}: ${v.description} (${v.nodes.length} nodes)`).join("\n")}`,
    ).toEqual([]);
  });
});
