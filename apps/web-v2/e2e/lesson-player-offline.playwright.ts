/**
 * Sprint 08 — a network drop mid-lesson is visible and recoverable.
 *
 * Drives the deterministic fixture, flips the browser offline, answers a
 * beat, and asserts the calm "saved on this device" toast appears while the
 * lesson keeps advancing (steps land in the offline outbox under their
 * idempotency keys and replay on reconnect — outbox behavior itself is
 * covered by lib/offline/outbox.test.ts).
 */
import { test, expect } from "@playwright/test";
import { setLearnerSession } from "./lesson-player-surfaces.helpers";

test("offline answer surfaces the saved-on-device toast and the lesson continues", async ({
  page,
  context,
}) => {
  await setLearnerSession(context);
  await page.goto("/learner/lesson-player-fixture?surfaceType=choice-grid", {
    waitUntil: "domcontentloaded",
  });
  const next = page.getByRole("button", { name: "Next" });
  await expect(next.first()).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);

  // Advancing posts a step → transport fails → outbox + one calm toast.
  await next.first().click();
  await expect(page.getByText("Saved on this device")).toBeVisible({ timeout: 10_000 });

  // The lesson is not blocked: the next beat's control is interactive.
  await expect(next.first().or(page.getByLabel("Answer choices").first())).toBeVisible();

  await context.setOffline(false);
});
