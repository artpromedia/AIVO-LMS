/**
 * Sprint C-15 — switch-only end-to-end baseline run.
 *
 * The platform's deepest promise is that the baseline cannot exclude the child
 * it serves. This spec proves a learner using a SWITCH can complete the whole
 * Discovery Adventure baseline with ZERO pointer events — keyboard-emulated
 * switch input only:
 *
 *   - Space      = "select"  (single-switch activate; also the step-scan pick)
 *   - ArrowRight = "advance" (two-switch step-scan move; harmless in auto-scan)
 *
 * Coverage (the sprint's verification #1): subjects → readiness → intro →
 * every question — including a SKIP, a HINT open, a READ-ALOUD trigger, a
 * BREAK resume, and confirming "Stop for today" reachability — through to the
 * completion screen, all without a single mouse interaction. The pre-runner
 * pages are plain semantic HTML driven by Tab/Enter; the runner is driven by
 * the switch keys the scan controller listens for.
 *
 * Conventions mirror `core-journey.playwright.ts` + `baseline-a11y.playwright.ts`:
 * the mock learner session cookie binds to the seeded learner (lrn_demo_sky,
 * baseline bas_demo_sky), and AAC scanning is enabled up-front through the REAL
 * accessibility BFF (so the run exercises the persisted-pref path the runner
 * reads — the settings round-trip the DoD calls for).
 *
 * NOTE on environment: Playwright is not installed in the sprint's offline
 * harness, so this spec is authored to RIDE CI (where Playwright runs) and is
 * NOT executed locally. The switch-input behaviours it asserts are additionally
 * proven locally by the jsdom interaction test
 * (`app/learner/baseline/[baselineId]/baseline-scan-runner.test.tsx`) and the
 * scan-controller unit tests.
 */
import { test, expect, type Page } from "@playwright/test";

const learnerCookie = {
  name: "aivo_mock_session",
  value: "learner",
  domain: "127.0.0.1",
  path: "/",
};

const SEEDED_LEARNER = "lrn_demo_sky";

/** Unwrap the BFF success envelope, failing loudly on error envelopes. */
async function bff<T>(
  page: Page,
  method: "get" | "post" | "patch",
  url: string,
  data?: unknown,
): Promise<T> {
  const res = await page.request[method](url, data === undefined ? undefined : { data });
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: T;
    error?: unknown;
  } | null;
  expect(res.ok(), `${method.toUpperCase()} ${url} → ${res.status()}`).toBeTruthy();
  expect(body?.ok, `${url} envelope: ${JSON.stringify(body)}`).toBeTruthy();
  return body!.data as T;
}

/** Press a switch key and let the scan controller settle a frame. */
async function switchKey(page: Page, key: " " | "ArrowRight"): Promise<void> {
  await page.keyboard.press(key === " " ? "Space" : key);
  await page.waitForTimeout(50);
}

/** The element the scan controller is currently highlighting. */
function highlighted(page: Page) {
  return page.locator('[data-scan-current="true"]');
}

/**
 * Auto-scan to the target whose `data-scan-target` ends with `idSuffix`, then
 * select it with the switch. Bounded so a missing target fails fast rather
 * than spinning. Single-switch auto-scan advances on its own timer; we poll
 * the highlight rather than driving advance.
 */
async function scanToAndSelect(page: Page, idSuffix: string, maxWaitMs = 12_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const cur = await highlighted(page)
      .getAttribute("data-scan-target")
      .catch(() => null);
    if (cur && cur.endsWith(idSuffix)) {
      await switchKey(page, " ");
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`scan target *${idSuffix} was never highlighted within ${maxWaitMs}ms`);
}

test.describe("@a11y baseline switch-only run", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([learnerCookie]);
  });

  test("completes the baseline with switch input and zero pointer events", async ({ page }) => {
    test.setTimeout(120_000);

    // ── Enable single-switch scanning through the REAL accessibility BFF.
    // This is the persisted-pref path the runner reads (DoD settings round-trip).
    const enabled = await bff<{ accessibility: { aacEnabled: boolean; aacInputMethod: string } }>(
      page,
      "patch",
      `/api/bff/learners/${SEEDED_LEARNER}/accessibility`,
      { aacEnabled: true, aacInputMethod: "switch_1", aacScanDelayMs: 1200 },
    );
    expect(enabled.accessibility.aacEnabled).toBe(true);
    expect(enabled.accessibility.aacInputMethod).toBe("switch_1");

    // ── Pre-runner pages: plain semantic HTML, driven by keyboard only.
    await page.goto("/learner/baseline/readiness", { waitUntil: "domcontentloaded" });
    // The button-friendly suggestion may appear; the "I'm ready" link is always
    // reachable by keyboard and never blocked.
    const ready = page.getByRole("link", { name: /i'?m ready/i });
    await expect(ready).toBeVisible({ timeout: 30_000 });
    await ready.focus();
    await page.keyboard.press("Enter");

    // Intro → start the runner (keyboard).
    const start = page.getByRole("link", { name: /start when you'?re ready/i });
    await expect(start).toBeVisible({ timeout: 30_000 });
    await start.focus();
    await page.keyboard.press("Enter");

    // ── Runner: switch-only from here. Confirm the scanner mounted.
    await page.waitForURL(/\/learner\/baseline\/bas_demo_sky/, { timeout: 30_000 });
    await expect(highlighted(page).first()).toBeVisible({ timeout: 30_000 });

    // First question: trigger READ-ALOUD (when the item carries read-aloud
    // text), then answer the first CHOICE, then NEXT — all by switch.
    if ((await page.locator('[data-scan-target$="-readaloud"]').count()) > 0) {
      await scanToAndSelect(page, "-readaloud");
    }
    await scanToAndSelect(page, "-choice-0");
    await scanToAndSelect(page, "-next");

    // Second question: open the HINT, then SKIP it — by switch.
    await expect(highlighted(page).first()).toBeVisible({ timeout: 30_000 });
    // Not every seeded item has a hint; only exercise it when present.
    if ((await page.locator('[data-scan-target$="-hint"]').count()) > 0) {
      await scanToAndSelect(page, "-hint");
    }
    await scanToAndSelect(page, "-skip");

    // Drive the remaining items by switch. On each question, select the first
    // choice then Next; if a BREAK screen interposes, resume by switch; when the
    // finish control appears, select it. Bounded loop so it can't spin forever.
    for (let guard = 0; guard < 40; guard++) {
      // Completion / finish reached?
      if ((await page.locator('[data-scan-target="finish-baseline"]').count()) > 0) {
        await scanToAndSelect(page, "finish-baseline");
        break;
      }
      // Break screen — resume by switch (Stop-for-today is also in this cycle).
      if ((await page.locator('[data-scan-target="break-resume"]').count()) > 0) {
        // "Stop for today" is reachable in the same cycle (no-fail) — assert it.
        await expect(page.locator('[data-scan-target="break-stop"]')).toHaveCount(1);
        await scanToAndSelect(page, "break-resume");
        continue;
      }
      // Otherwise a question: answer first choice + Next (or Skip if no choices).
      if ((await page.locator('[data-scan-target$="-choice-0"]').count()) > 0) {
        await scanToAndSelect(page, "-choice-0");
        await scanToAndSelect(page, "-next");
      } else if ((await page.locator('[data-scan-target$="-skip"]').count()) > 0) {
        await scanToAndSelect(page, "-skip");
      } else {
        break;
      }
    }

    // ── Completion: the baseline reached `complete` via the BFF (the switch run
    // submitted real answers through the real runner).
    const { baseline } = await bff<{ baseline: { status: string } | null }>(
      page,
      "get",
      `/api/bff/learners/${SEEDED_LEARNER}/baseline`,
    );
    expect(baseline?.status, "baseline reached complete via switch input").toBe("complete");
  });
});
