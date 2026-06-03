import { test, expect } from "@playwright/test";

/**
 * Sprint 8 (Status, Health, Incidents) — incident lifecycle, e2e.
 *
 * Documents and (when the harness is up) exercises the Definition-of-Done
 * flow across web-v2 + status-page-svc:
 *
 *   1. A platform admin declares an incident
 *      (/admin/platform/status/incidents/new) — opens `investigating`.
 *   2. They post updates that walk the lifecycle
 *      investigating -> identified -> monitoring -> resolved.
 *   3. The public /status page reflects each transition (and the latest
 *      update body), as does the district status view.
 *   4. On resolve, the incident shows resolved and (optionally) a
 *      postmortem link.
 *
 * Auth: the app uses mock sessions in e2e. This spec depends on the shared
 * fixtures in `e2e/lib/fixtures.ts` (`seedPlatformAdmin`, `seedSchoolAdmin`,
 * `authenticateBrowser`) and identity-svc test-mode helpers
 * (`skipUnlessIdentityTestMode`). The public `/status` page is anonymous and
 * needs no auth. Where helpers are unavailable the suite skips rather than
 * failing CI (cf. `tests/admin-identity.spec.ts`).
 *
 * NOTE: Sprint 8 page selectors are not all confirmed, so steps navigate by
 * role-route and assert on accessible text/roles. Marked `fixme` until the
 * seed helpers + data-testid hooks for the status console land; the steps
 * below are the intended journey.
 */

import {
  seedPlatformAdmin,
  seedSchoolAdmin,
  authenticateBrowser,
  skipUnlessIdentityTestMode,
} from "../../lib/fixtures";

const TITLE = `e2e status incident ${Date.now()}`;

const LIFECYCLE: Array<{ name: RegExp; update: string }> = [
  { name: /identified/i, update: "Root cause identified: upstream dependency." },
  { name: /monitoring/i, update: "Mitigation applied; monitoring recovery." },
  { name: /resolved/i, update: "Recovery confirmed and sustained. All clear." },
];

test.describe("Status page — declare incident, walk lifecycle, public + district views", () => {
  test.fixme(
    true,
    "Enable once status-page-svc + identity test-mode seed helpers and status-console data-testid hooks are wired in e2e.",
  );

  test("platform admin declares, updates, and resolves an incident; public + district pages track it", async ({
    page,
    browser,
  }) => {
    await skipUnlessIdentityTestMode();

    // ── Platform admin: declare ───────────────────────────────────────────
    const platform = await seedPlatformAdmin();
    test.skip(!platform, "could not seed platform admin");
    await authenticateBrowser(page, platform!);

    // 1) Declare the incident (opens in `investigating`).
    await page.goto("/admin/platform/status/incidents/new");
    await page.getByLabel(/title/i).fill(TITLE);
    await page.getByLabel(/impact/i).selectOption({ label: "Major" }).catch(async () => {
      await page.getByText(/major/i).first().click();
    });
    await page.getByLabel(/message|update|details/i).fill("We are investigating elevated errors.");
    await page.getByRole("button", { name: /create incident|declare|publish/i }).click();
    await expect(page.getByText(TITLE)).toBeVisible();
    await expect(page.getByText(/investigating/i)).toBeVisible();

    // ── Public + district pages: investigating is visible ─────────────────
    const publicCtx = await browser.newContext();
    const publicPage = await publicCtx.newPage();
    await publicPage.goto("/status");
    await expect(publicPage.getByText(TITLE)).toBeVisible({ timeout: 15_000 });
    await expect(publicPage.getByText(/investigating/i)).toBeVisible();

    const district = await seedSchoolAdmin();
    const districtCtx = await browser.newContext();
    const districtPage = await districtCtx.newPage();
    if (district) {
      await authenticateBrowser(districtPage, district);
      await districtPage.goto("/admin/district/status");
      await expect(districtPage.getByText(TITLE)).toBeVisible({ timeout: 15_000 });
    }

    // 2-3) Walk the lifecycle; each transition posts a public update that the
    //      public + district pages must reflect.
    for (const step of LIFECYCLE) {
      await page.bringToFront();
      await page.getByRole("button", { name: /post update|add update|new update/i }).click();
      // Choose the next lifecycle state.
      await page.getByLabel(/status|lifecycle|state/i).selectOption({ label: step.name.source }).catch(async () => {
        await page.getByRole("radio", { name: step.name }).first().click();
      });
      await page.getByLabel(/message|update|body/i).fill(step.update);
      await page.getByRole("button", { name: /post|publish|save/i }).click();
      await expect(page.getByText(step.name)).toBeVisible();

      // Public page reflects the new lifecycle + latest update body.
      await publicPage.reload();
      await expect(publicPage.getByText(step.name)).toBeVisible({ timeout: 15_000 });
      await expect(publicPage.getByText(step.update, { exact: false })).toBeVisible();

      if (district) {
        await districtPage.reload();
        await expect(districtPage.getByText(step.name)).toBeVisible({ timeout: 15_000 });
      }
    }

    // 4) Resolved state is terminal and shown on the public page.
    await expect(publicPage.getByText(/resolved/i)).toBeVisible();

    await publicCtx.close();
    await districtCtx.close();
  });
});
