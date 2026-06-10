import { test, expect } from "@playwright/test";

/**
 * Sprint 9 (Secure Impersonation — "View As") — full admin journey, e2e.
 *
 * Documents and (when the harness is up) exercises the Definition-of-Done
 * flow across web-v2 + identity-svc + the every-service write guard:
 *
 *   1. A platform admin impersonates a learner and views the learner
 *      dashboard; the full-width amber ImpersonationBanner is visible.
 *   2. Attempting a write (post a comment) is BLOCKED — the session is
 *      writes-off (deny-by-default; not on the imp-write-allowlist).
 *   3. The banner PERSISTS across navigation (AppShell watermark/accent).
 *   4. "Exit View-As" returns to the original admin session in one click.
 *   5. A district admin attempting to impersonate a PLATFORM admin gets 403
 *      (RBAC matrix: only platform_admin may target an admin, with
 *      break-glass; district admins cannot target platform/district admins).
 *
 * Auth: the app uses mock sessions in e2e. This spec depends on the shared
 * fixtures in `e2e/lib/fixtures.ts` (`seedPlatformAdmin`, `seedSchoolAdmin`,
 * `seedParent`, `seedLearnerForParent`, `authenticateBrowser`) and on
 * identity-svc test-mode helpers (`skipUnlessIdentityTestMode`). Starting an
 * impersonation session additionally needs identity-svc step-up MFA in
 * test-mode (a deterministic OTP) and the `impersonation_sessions` store
 * (migration 0049). Where those helpers are unavailable the suite skips
 * rather than failing CI, matching `tests/admin-identity.spec.ts`.
 *
 * NOTE: stable selectors for the Sprint 9 pages are not all confirmed, so the
 * steps navigate by role-route (`/admin/platform/users`, `/learn/*`) and
 * assert on accessible text/roles. Marked `fixme` until the seed helpers,
 * identity test-mode MFA, and the impersonation data-testid hooks
 * (StartImpersonationModal, ImpersonationBanner) land; the steps below are the
 * intended journey.
 */

import {
  seedPlatformAdmin,
  seedSchoolAdmin,
  seedParent,
  seedLearnerForParent,
  authenticateBrowser,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

test.describe("Secure Impersonation — View As a learner, write-blocked, banner, exit, RBAC", () => {
  // Requires identity test-mode seeding + step-up MFA + the identity-svc stack.
  test.fixme(
    true,
    "Enable once identity-svc impersonation (step-up MFA test-mode + impersonation_sessions) and the StartImpersonationModal/ImpersonationBanner data-testid hooks are wired in e2e.",
  );

  test("platform admin views a learner (writes blocked), banner persists, exits in one click", async ({
    page,
    browser,
  }) => {
    await skipUnlessIdentityTestMode();

    // ── Seed a learner to impersonate ─────────────────────────────────────
    const parent = await seedParent();
    test.skip(!parent, "could not seed parent");
    const learner = await seedLearnerForParent(parent!);
    test.skip(!learner, "could not seed learner");

    // ── Platform admin session ────────────────────────────────────────────
    const platform = await seedPlatformAdmin();
    test.skip(!platform, "could not seed platform admin");
    await authenticateBrowser(page, platform!);

    // 1) Start a "View As" session against the learner. Open the start modal
    //    from the user's admin row, give a reason, pass step-up MFA. The
    //    session is writes-off by default (no imp_writes_ok).
    await page.goto(`/admin/platform/users/${learner!.learnerId}`);
    await page.getByRole("button", { name: /view as|impersonate/i }).click();

    await page.getByLabel(/reason/i).fill("Support: diagnosing broken learner dashboard.");
    // Leave "allow writes" off — this session is read-only.
    // Step-up MFA challenge (deterministic OTP in identity test-mode).
    await page
      .getByLabel(/code|otp|mfa/i)
      .fill("000000")
      .catch(() => undefined);
    await page.getByRole("button", { name: /start|confirm|view as/i }).click();

    // We are now impersonating: the learner dashboard renders...
    await expect(page).toHaveURL(/\/learn\//, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /dashboard|my learning|today/i })).toBeVisible();

    // ...and the full-width amber banner is visible with the subject + a TTL
    //    countdown and an Exit control.
    const banner = page.getByTestId("impersonation-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(new RegExp(learner!.name ?? "viewing as", "i"));
    await expect(banner).toContainText(/exit|stop/i);
    // TTL countdown is shown (mm:ss), clamped to <= 30 min.
    await expect(banner).toContainText(/\d{1,2}:\d{2}/);

    // 2) Writes are blocked (deny-by-default; route not on imp-write-allowlist).
    //    Attempt to post a comment and assert it is refused, not accepted.
    const commentBox = page.getByLabel(/comment|message/i).first();
    if (await commentBox.isVisible().catch(() => false)) {
      await commentBox.fill("test comment from impersonated session");
      const [resp] = await Promise.all([
        page
          .waitForResponse((r) => /\/api\/.*(comment|message)/i.test(r.url()), { timeout: 10_000 })
          .catch(() => null),
        page
          .getByRole("button", { name: /post|send|submit/i })
          .first()
          .click(),
      ]);
      // The guard returns 403 for a non-allowlisted write under impersonation.
      if (resp) expect(resp.status()).toBe(403);
      // And the UI surfaces a "read-only / writes disabled" affordance.
      await expect(
        page.getByText(/read.?only|writes? (are )?(disabled|blocked)|view.?only/i),
      ).toBeVisible();
    }

    // 3) Banner persists across navigation (AppShell watermark/accent).
    await page.goto(`/learn/${learner!.learnerId}/progress`);
    await expect(page.getByTestId("impersonation-banner")).toBeVisible();
    await expect(page.getByTestId("impersonation-watermark")).toBeVisible();

    // 4) "Exit View-As" returns to the original admin session in one click.
    await page
      .getByTestId("impersonation-banner")
      .getByRole("button", { name: /exit|stop/i })
      .click();
    await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);
    // Back in the platform admin context (the impersonation token is gone).
    await page.goto("/admin/platform/users");
    await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();
    await expect(page.getByTestId("impersonation-watermark")).toHaveCount(0);

    // 5) RBAC: a district admin cannot impersonate a platform admin → 403.
    //    (school-admin fixture stands in for a scoped, non-platform admin.)
    const districtAdmin = await seedSchoolAdmin();
    test.skip(!districtAdmin, "could not seed district/school admin");

    const districtCtx = await browser.newContext();
    const districtPage = await districtCtx.newPage();
    await authenticateBrowser(districtPage, districtAdmin!);

    // Attempt to start "View As" against the platform admin's user id.
    const start = await districtPage.request.post("/api/impersonation/start", {
      data: {
        subjectUserId: platform!.userId ?? platform!.actorId,
        reason: "should be refused — cross-privilege target",
      },
    });
    expect(start.status()).toBe(403);
    const body = await start.json().catch(() => ({}));
    // Refused by the RBAC matrix (admin target / out-of-scope), not minted.
    expect(JSON.stringify(body)).toMatch(/ADMIN_TARGET_FORBIDDEN|OUT_OF_SCOPE|forbidden/i);

    await districtCtx.close();
  });
});
