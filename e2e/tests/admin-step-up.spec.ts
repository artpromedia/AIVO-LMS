import { test, expect } from "@playwright/test";

/**
 * Sprint 3 (Enterprise Admin Hardening) — step-up authentication on
 * destructive admin operations.
 *
 * Validates the user-visible contract for the step-up modal on a
 * tenant-deletion flow:
 *   1. Triggering a destructive admin action without a valid step-up
 *      token surfaces the StepUpModal.
 *   2. Submitting a wrong code shows an inline error and keeps the modal
 *      open.
 *   3. Submitting the right code closes the modal and the original action
 *      proceeds.
 *
 * Requires PLATFORM_ADMIN credentials + a deletable tenant id and a
 * pre-shared TOTP shared secret so we can compute valid/invalid codes
 * deterministically. When env is missing the test is skipped — this keeps
 * the suite usable in any environment.
 */

const ADMIN_EMAIL = process.env.E2E_PLATFORM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_PLATFORM_ADMIN_PASSWORD;
const ADMIN_TOTP_SECRET = process.env.E2E_PLATFORM_ADMIN_TOTP_SECRET;
const DELETABLE_TENANT_ID = process.env.E2E_DELETABLE_TENANT_ID;

test.describe("admin step-up auth on destructive ops", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_TOTP_SECRET || !DELETABLE_TENANT_ID,
    "Requires E2E_PLATFORM_ADMIN_EMAIL/PASSWORD/TOTP_SECRET and E2E_DELETABLE_TENANT_ID",
  );

  test("tenant suspend prompts step-up; wrong code fails, right code succeeds", async ({
    page,
    request,
  }) => {
    // Login as PLATFORM_ADMIN
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/dashboard|admin/i);

    // Navigate to tenants list and trigger a suspend on the seeded tenant
    await page.goto(`/dashboard/admin/tenants/${DELETABLE_TENANT_ID}`);
    await page.getByRole("button", { name: /suspend tenant/i }).click();

    // Step-up modal should appear
    const modal = page.getByTestId("step-up-modal");
    await expect(modal).toBeVisible();

    // Choose TOTP factor explicitly (skip if passkey is preselected)
    const totpInput = modal.getByTestId("stepup-totp-input");
    await expect(totpInput).toBeVisible();

    // Submit a wrong code first
    await totpInput.fill("000000");
    await modal.getByTestId("stepup-submit").click();
    await expect(modal.getByTestId("stepup-error")).toBeVisible();
    await expect(modal).toBeVisible();

    // Compute the right code from the shared secret
    const { TOTP, Secret } = await import("otpauth");
    const totp = new TOTP({
      issuer: "AIVO",
      label: ADMIN_EMAIL!,
      secret: Secret.fromBase32(ADMIN_TOTP_SECRET!),
    });
    const validCode = totp.generate();

    await totpInput.fill(validCode);
    await modal.getByTestId("stepup-submit").click();

    // Modal should close, action should succeed
    await expect(modal).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(/suspended|inactive/i)).toBeVisible({ timeout: 10_000 });
  });
});
