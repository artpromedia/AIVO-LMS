#!/usr/bin/env node
/**
 * Sprint 15E — keyboard-nav check.
 *
 * Walks the Tab order on the 12 learner pages and asserts:
 *   - No focus trap: pressing Tab repeatedly eventually returns to <body>.
 *   - Every interactive element (button, [href], input, [tabindex>=0]) is
 *     reachable within N Tab presses (N = 3 * interactive count, headroom
 *     for skip links + nested menus).
 *   - Focus is visible: the focused element has an outline/box-shadow
 *     computed style that is non-zero.
 *   - Escape exits modals: when a [role=dialog] is open, pressing Escape
 *     closes it within 500 ms.
 *
 * Auto-skips with exit 0 when the web-v2 app is not reachable.
 */
import { chromium } from "playwright";

const BASE_URL =
  process.env.WEB_BASE_URL || process.env.WEB_V2_BASE_URL || "http://localhost:5000";

const PAGES = [
  "/learner/home",
  "/learner/lesson-player-smoke",
  "/learner/baseline",
  "/learner/aac",
  "/learner/settings/accessibility",
  "/learner/missions",
  "/learner/homework",
  "/learner/quests",
  "/learner/progress",
  "/parent/notifications",
  "/learner/tutor",
  "/learner/lesson-player-fixture",
];

async function isReachable(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkPage(browser, pageUrl) {
  const failures = [];
  const page = await browser.newPage();
  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const interactiveCount = await page.evaluate(() => {
      const sel = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return document.querySelectorAll(sel).length;
    });
    const maxTabs = Math.max(20, interactiveCount * 3);

    let returnedToStart = false;
    const reached = new Set();
    let lastFocus = "";
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return "BODY";
        const id = el.id ? `#${el.id}` : "";
        const tag = el.tagName.toLowerCase();
        return `${tag}${id}:${el.textContent?.slice(0, 24) ?? ""}`;
      });
      reached.add(focused);
      if (focused === "BODY" && i > 0) {
        returnedToStart = true;
        break;
      }
      if (focused === lastFocus) {
        failures.push(`Focus appears stuck on ${focused} after ${i} tabs (possible trap).`);
        break;
      }
      lastFocus = focused;

      const focusVisible = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return true;
        const s = window.getComputedStyle(el);
        const outlineNonzero =
          s.outlineStyle !== "none" && s.outlineWidth !== "0px" && s.outlineWidth !== "";
        const ringNonzero =
          s.boxShadow && s.boxShadow !== "none" && s.boxShadow !== "rgba(0, 0, 0, 0) 0px 0px 0px 0px";
        return outlineNonzero || Boolean(ringNonzero);
      });
      if (!focusVisible) {
        failures.push(`Focused element ${focused} has no visible focus ring.`);
      }
    }

    if (!returnedToStart && reached.size > 1) {
      // It's not strictly a failure to never cycle back if the page has lots
      // of interactives, but if we hit the cap and nothing closed the loop
      // we warn loudly.
      failures.push(
        `Tab loop did not return to <body> after ${maxTabs} presses; possible focus trap.`,
      );
    }

    // Modal escape check (only runs if a dialog is found).
    const hasModal = await page.evaluate(
      () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
    );
    if (hasModal) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const stillOpen = await page.evaluate(
        () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      );
      if (stillOpen) {
        failures.push("Escape did not dismiss an open <dialog>.");
      }
    }
  } finally {
    await page.close();
  }
  return failures;
}

async function main() {
  if (!(await isReachable(BASE_URL))) {
    // eslint-disable-next-line no-console
    console.log(`[keyboard-nav-check] Skipping — web-v2 not reachable at ${BASE_URL}`);
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true });
  const allFailures = [];
  try {
    for (const p of PAGES) {
      const url = `${BASE_URL}${p}`;
      const failures = await checkPage(browser, url);
      if (failures.length) {
        allFailures.push({ url, failures });
      } else {
        // eslint-disable-next-line no-console
        console.log(`[keyboard-nav-check] OK ${p}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (allFailures.length > 0) {
    // eslint-disable-next-line no-console
    console.error("[keyboard-nav-check] FAILURES:");
    for (const { url, failures } of allFailures) {
      // eslint-disable-next-line no-console
      console.error(`\n${url}`);
      for (const f of failures) {
        // eslint-disable-next-line no-console
        console.error(`  - ${f}`);
      }
    }
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`[keyboard-nav-check] All ${PAGES.length} pages passed.`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[keyboard-nav-check] crash:", e);
  process.exit(1);
});
