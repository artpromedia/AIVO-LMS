/**
 * Sprint 15E — WCAG 2.2 AA verification on the 12 critical learner pages.
 *
 * For each page we:
 *   1. Navigate to it (the test auto-skips when the web-v2 app is not
 *      reachable on the configured base URL — we don't want this suite to
 *      false-fail when run on a developer laptop without the stack up).
 *   2. Inject axe-core (loaded from the npm package via require.resolve) and
 *      run it with the WCAG 2.0/2.1/2.2 A + AA rule tags.
 *   3. Fail the test if any violation is reported. Known/accepted violations
 *      should be documented under
 *      `docs/accessibility/wcag-2.2-aa-evidence.md` and added to the
 *      `ACCEPTED_VIOLATIONS` allow-list with a remediation owner so we don't
 *      keep flagging the same issue.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.WEB_BASE_URL || process.env.WEB_V2_BASE_URL || "http://localhost:5000";

/**
 * The 12 critical learner-facing pages. Each entry is the path under the
 * web-v2 app the test should navigate to. Login is assumed to be handled by
 * the dev mock-auth provider (AUTH_MODE=mock).
 */
const PAGES: Array<{ name: string; path: string }> = [
  { name: "home", path: "/learner/home" },
  { name: "lesson-player", path: "/learner/lesson-player-smoke" },
  { name: "baseline-assessment", path: "/learner/baseline" },
  { name: "aac-board", path: "/learner/aac" },
  { name: "settings", path: "/learner/settings/accessibility" },
  { name: "todays-mission", path: "/learner/missions" },
  { name: "homework", path: "/learner/homework" },
  { name: "quest", path: "/learner/quests" },
  { name: "progress", path: "/learner/progress" },
  { name: "family-chat", path: "/parent/notifications" },
  { name: "problem-session", path: "/learner/tutor" },
  { name: "voice-response", path: "/learner/lesson-player-fixture" },
];

/**
 * Violation rule IDs we have accepted as known and are tracking under
 * docs/accessibility/wcag-2.2-aa-evidence.md. Empty for now — populate as
 * findings are triaged.
 */
const ACCEPTED_VIOLATIONS = new Set<string>([]);

async function loadAxeSource(): Promise<string> {
  // Lazy-resolve axe-core so tests skip cleanly when the package isn't
  // installed (e.g. on a fresh worktree without dev deps).
  let axePath: string;
  try {
    axePath = require.resolve("axe-core/axe.min.js");
  } catch {
    throw new Error("axe-core is not installed in e2e/. Run `pnpm install --filter @aivo/e2e`.");
  }
  return readFileSync(axePath, "utf8");
}

async function injectAxe(page: Page): Promise<void> {
  const source = await loadAxeSource();
  await page.addScriptTag({ content: source });
}

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: Array<{ target: string[]; html: string }>;
}

async function runAxe(page: Page): Promise<AxeViolation[]> {
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected by the test harness.
    const results = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return results.violations as AxeViolation[];
  });
}

test.describe("Sprint 15 — WCAG 2.2 AA on learner pages", () => {
  test.beforeAll(async () => {
    // Auto-skip the entire suite when the web app isn't reachable, so the
    // file is safe to include in CI even when web-v2 isn't running yet.
    const res = await fetch(BASE_URL, { method: "GET" }).catch(() => null);
    if (!res || !res.ok) {
      test.skip(true, `web-v2 not reachable at ${BASE_URL}`);
    }
  });

  for (const { name, path: urlPath } of PAGES) {
    test(`${name} (${urlPath}) passes axe-core`, async ({ page }) => {
      await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: "domcontentloaded" });
      // Give the page a moment for hydration before we run axe.
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await injectAxe(page);
      const violations = await runAxe(page);
      const blocking = violations.filter((v) => !ACCEPTED_VIOLATIONS.has(v.id));

      if (blocking.length > 0) {
        // Surface every violation in the failure message so the CI log is
        // self-contained.
        const detail = blocking
          .map(
            (v) =>
              `  - [${v.impact ?? "n/a"}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n    targets:\n${v.nodes
                .map((n) => `      ${n.target.join(" ")}`)
                .join("\n")}`,
          )
          .join("\n");
        // Persist the result on the test artifact for later triage.
        await page.context().tracing.start({ snapshots: true });
        expect.soft(blocking, `axe violations on ${urlPath}:\n${detail}`).toEqual([]);
      } else {
        expect(blocking).toEqual([]);
      }
    });
  }
});
