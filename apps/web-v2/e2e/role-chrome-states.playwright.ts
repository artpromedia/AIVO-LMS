/**
 * Sprint 09 — boundary states keep their role chrome; signup explains itself.
 *
 *   1. A bad URL inside a role area renders the role 404 WITH that role's
 *      navigation landmarks (the audit's bare-white-404 regression guard).
 *   2. Caregiver/therapist groups now have boundary coverage too.
 *   3. Signup: the submit stays enabled; an invalid submit blocks the server
 *      action, marks fields inline (aria-describedby association via
 *      AuthInput) and focuses the first invalid field.
 *
 * Tagged @a11y so the axe lane covers the new chrome.
 */
import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const AXE_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
  "landmark-one-main": { enabled: false },
  "page-has-heading-one": { enabled: false },
} as const;

const cookie = (value: string) => ({
  name: "aivo_mock_session",
  value,
  domain: "127.0.0.1",
  path: "/",
});

const CASES = [
  { role: "parent", badPath: "/parent/learners/does-not-exist", navLabel: "Learners" },
  { role: "learner", badPath: "/learner/subjects/does-not-exist", navLabel: "Missions" },
  { role: "teacher", badPath: "/teacher/learners/does-not-exist", navLabel: "Classes" },
] as const;

test.describe("role-chrome boundary states", () => {
  for (const c of CASES) {
    test(`@a11y ${c.role} 404 keeps role chrome`, async ({ page, context }) => {
      await context.addCookies([cookie(c.role)]);
      await page.goto(c.badPath, { waitUntil: "domcontentloaded" });
      // The role nav must be present (the old behavior was a bare page).
      await expect(page.getByRole("navigation")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("link", { name: c.navLabel }).first()).toBeVisible();
      await injectAxe(page);
      await checkA11y(page, "main", {
        detailedReport: true,
        detailedReportOptions: { html: true },
        axeOptions: { rules: AXE_RULES },
      });
    });
  }

  test("signup validates inline with an always-enabled submit", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    const submit = page.getByRole("button", { name: /create|sign up|start/i }).first();
    await expect(submit).toBeVisible({ timeout: 30_000 });
    await expect(submit).toBeEnabled();

    // Invalid email on blur → inline error associated with the field.
    const email = page.locator("#email");
    await email.fill("not-an-email");
    await email.blur();
    await expect(page.locator("#email-error")).toBeVisible();

    // Submitting with problems blocks the action and focuses the first
    // invalid field (name, which is empty).
    await submit.click();
    await expect(page.locator("#name-error")).toBeVisible();
    await expect(page.locator("#name")).toBeFocused();
    await expect(page).toHaveURL(/\/signup/);
  });
});
