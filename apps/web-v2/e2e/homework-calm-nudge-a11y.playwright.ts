/**
 * Homework → Calm nudge — a11y smoke (tagged @a11y so it runs under
 * `pnpm test:a11y`).
 *
 * With the `selfRegulationHub` flag on (set on the e2e web server), a
 * stretch of inactivity in the homework chat should surface a gentle,
 * dismissible "calm break" card that deep-links to the right Calm
 * activity. We drive time with Playwright's clock so the 120s inactivity
 * threshold is reached deterministically instead of by real waiting.
 */
import { test, expect } from "@playwright/test";

const LEARNER_ID = "lrn_demo_sky";
const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

test.describe("@a11y homework calm nudge", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([learnerCookie]);
  });

  test("surfaces a dismissible calm break on inactivity", async ({ page, request }) => {
    // Bootstrap a homework session (the demo learner is consent-seeded and the
    // opening reply is generated deterministically — no live AI dependency).
    const created = await request.post(`/api/bff/learners/${LEARNER_ID}/homework`, {
      data: { topic: "Fractions practice" },
    });
    expect(created.ok()).toBeTruthy();
    const payload = (await created.json()) as { data: { session: { id: string } } };
    const sessionId = payload.data.session.id;

    // Freeze time before the page scripts run so the inactivity timer is
    // anchored to the fake clock, then jump past the break threshold.
    await page.clock.install();
    await page.goto(`/learner/homework/${sessionId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("textbox")).toBeVisible();

    await page.clock.fastForward(130_000);

    // The nudge appears, is keyboard-reachable, and deep-links into Calm.
    const accept = page.getByRole("link", { name: /calm break/i });
    await expect(accept).toBeVisible();
    await expect(accept).toHaveAttribute("href", "/learner/calm?action=offer_break");

    // It is dismissible and never blocks the chat.
    await page.getByRole("button", { name: /not now/i }).click();
    await expect(accept).toHaveCount(0);
    await expect(page.getByRole("textbox")).toBeVisible();
  });
});
