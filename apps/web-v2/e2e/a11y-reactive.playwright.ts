import { test, expect } from "@playwright/test";

/**
 * Sprint A8 — accessibility preferences apply LIVE across tabs.
 *
 * The sensory mode is the motion/contrast control for neurodiverse
 * learners; changing it on one screen must reflect on every open tab
 * without a reload (BroadcastChannel "aivo-a11y", plus focus re-sync).
 */
const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  url: "http://127.0.0.1:5000",
};

test("changing sensory mode in tab A flips tab B without reload", async ({ context }) => {
  await context.addCookies([learnerCookie]);

  const tabA = await context.newPage();
  const tabB = await context.newPage();
  await tabB.goto("/learner/home");
  await tabB.waitForSelector("main");
  const initial = await tabB.evaluate(() =>
    document.documentElement.getAttribute("data-sensory-mode"),
  );
  expect(initial).toBe("standard");

  await tabA.goto("/");
  await tabA.waitForSelector("main");
  // The landing header renders the segmented sensory radiogroup
  // (Standard / Calm / High Contrast).
  await tabA
    .getByRole("radiogroup", { name: /sensory mode/i })
    .first()
    .getByRole("radio", { name: /calm/i })
    .click();
  await expect
    .poll(
      () => tabA.evaluate(() => document.documentElement.getAttribute("data-sensory-mode")),
      { timeout: 5_000 },
    )
    .toBe("calm");

  // Tab B updates from the broadcast — no reload, no navigation.
  await expect
    .poll(
      () => tabB.evaluate(() => document.documentElement.getAttribute("data-sensory-mode")),
      { timeout: 5_000 },
    )
    .toBe("calm");
});
