/**
 * District-pilot e2e helpers.
 *
 * Builds on e2e/lib/fixtures.ts (identity test-mode seeding) to drive the
 * real web-v2 auth surface — the pilot journey signs users in through the
 * actual /login form against identity-svc, never the mock cookie.
 *
 * The journey this file supports is grown sprint-by-sprint:
 *   Sprint 0 — a real parent session in web-v2 (this file's `loginThroughWebUi`)
 *   Sprint 1 — platform-admin provisions a district pilot (coupon redeemed)
 *   Sprint 2 — district/school admin invites parents into the district tenant
 *   Sprint 3 — invited parent creates a learner under the seat cap + consent
 *   Sprint 4 — pilot ops dashboard (seats / uptake / expiry)
 */
import { expect, type Page } from "@playwright/test";
import { WEB_BASE } from "./fixtures";

/** Cookie names written by the web-v2 BFF (see lib/auth/session-cookies.ts). */
export const REAL_SESSION_COOKIE = "aivo_session";
export const REAL_ACCESS_TOKEN_COOKIE = "aivo_access_token";
export const MOCK_SESSION_COOKIE = "aivo_mock_session";

/**
 * Sign a user in through the real /login form and wait for the role-home
 * redirect. Returns once navigation settles so the caller can assert on the
 * landed surface.
 */
export async function loginThroughWebUi(
  page: Page,
  creds: { email: string; password: string; expectPath: string },
): Promise<void> {
  await page.goto(`${WEB_BASE}/login`);
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await page.click('button[type="submit"][form="login-form"]');
  await page.waitForURL(`**${creds.expectPath}`, { timeout: 15_000 });
}

/**
 * Assert the browser holds a real identity-svc session and NOT a mock one.
 * This is the load-bearing G1 check: in a real-auth deployment the mock
 * cookie must never be set, and the real session snapshot must be present.
 */
export async function assertRealSessionNoMock(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  const names = new Set(cookies.map((c) => c.name));
  expect(names.has(REAL_SESSION_COOKIE), "real aivo_session cookie present").toBe(true);
  expect(names.has(MOCK_SESSION_COOKIE), "mock cookie must be absent on pilot path").toBe(false);
}
