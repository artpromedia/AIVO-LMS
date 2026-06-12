# Sprint 02 — Accessibility CI gate: axe lane blocks PRs (web + first admin coverage)

## Goal

At the end of this sprint, an axe-core accessibility regression **fails CI** before it can merge. The eight existing `@a11y` Playwright suites in web-v2 run as a blocking job on every PR that touches web code, and the admin app gets its first automated axe coverage by extending specs that already run against a real booted admin in the compose lane. Today these suites exist but **no workflow runs them** — accessibility (the product's core promise) has zero runtime regression protection. Closes audit gap **B3 (🚨)**.

## Context

- **What already exists (do not rebuild):**
  - Web a11y specs: `apps/web-v2/e2e/*-a11y.playwright.ts` — 8 files (`a11y-reactive`, `audit-a11y`, `billing-chart-a11y`, `calm-corner-a11y`, `homework-calm-nudge-a11y`, `identity-a11y`, `role-a11y`, `sis-a11y`) using `axe-playwright` (`injectAxe`, `checkA11y` — see `apps/web-v2/e2e/audit-a11y.playwright.ts:7,26-27`). Tests are tagged `@a11y`; the app's package script is `"test:a11y": "playwright test --grep @a11y"` (`apps/web-v2/package.json`).
  - Playwright boots the app itself: `apps/web-v2/playwright.config.ts:13-15` defines `webServer: { command: "corepack pnpm dev", port: 5000 }`. `AUTH_MODE` defaults to `"mock"` outside production (`apps/web-v2/lib/env.ts:35-43`), so no extra auth setup is needed in CI. The dev script also builds `@aivo/brand` first (see `apps/web-v2/package.json` `dev` script), so token artifacts are handled.
  - Static a11y gates already in CI: `.github/workflows/accessibility.yml` jobs `a11y-contract-gates` (lines 53-82: `accessibility:audit`, `a11y:audit`, `a11y:no-inert-prefs`) — these stay; they are declaration gates, not runtime axe.
  - Admin e2e that already runs in CI: root `e2e/specs/admin/*.spec.ts` (`audit-reads`, `branding`, `charts-foundation`, `district-overview`, `login-mfa`, `nav-shell`, `no-fixme-guard`, `pilot-provision`, …) executed by the `sprint12-e2e` job (`.github/workflows/ci.yml:742`) against `docker-compose.e2e.yml`, which boots `web-admin` (line 277) plus `identity-svc`, `postgres`, `redis`, `admin-svc`, etc. This is the **only** environment where admin pages render with real auth — admin axe checks must ride here.
- **CI shape:** `.github/workflows/ci.yml` jobs of interest: `lint-and-typecheck` (line 20), `repo-tests` (41), `bff-integration` (142, runs Playwright API tests — copy its pnpm/playwright setup steps), `web-bundle-budget` (267), `sprint12-e2e` (742). Path-filter patterns for "web changed" can be copied from `web-bundle-budget`.

## Work orders

### DELETE
- None.

### CREATE
1. New job **`web-a11y-axe`** in `.github/workflows/ci.yml`:
   - Triggers on the same web-v2 path filters as `web-bundle-budget` (plus `packages/ui/**`, `packages/learner-surfaces/**`, `packages/brand/**`, `apps/web-v2/e2e/**`).
   - Steps (mirror the checkout/pnpm/node setup used by `bff-integration`): install deps; `corepack pnpm --filter @aivo/web-v2 exec playwright install chromium --with-deps`; run `corepack pnpm --filter @aivo/web-v2 run test:a11y`.
   - Upload Playwright traces/screenshots as an artifact on failure (`actions/upload-artifact`, `if: failure()`).
   - **No `continue-on-error`.** The job must be a hard gate.
2. New spec `apps/web-v2/e2e/parent-teacher-a11y.playwright.ts` if (and only if) the current `@a11y` set does not already cover one page per role shell. First **read** `apps/web-v2/e2e/role-a11y.playwright.ts` and list which routes it scans; the required minimum coverage set is: `/login`, `/parent/home`, `/learner/home`, `/learner/settings/accessibility`, `/teacher/home`. Add only the missing ones, following `role-a11y`'s exact pattern (mock cookie, `injectAxe`, `checkA11y(page, "main", …)`).

### REFACTOR
- None.

### EDIT
1. Root `e2e/specs/admin/charts-foundation.spec.ts`, `e2e/specs/admin/audit-reads.spec.ts`, `e2e/specs/admin/district-overview.spec.ts` — after each spec's existing page-load assertions, add `injectAxe` + `checkA11y` with `detailedReport: true`, failing on `serious`/`critical` impact. Check the root `e2e/` package/deps first: if `axe-playwright` is not a dependency of the root e2e workspace, add it to the correct `package.json` (match how `apps/web-v2` declares it, `^2.1.0`).
2. If running the suites surfaces **pre-existing** serious/critical violations on the covered routes, fix them in this sprint (these are expected to be small: missing labels/landmark issues). Per-rule exclusions are allowed **only** for documented false positives, with the reason inline in the spec — never to skip a real defect.
3. `README.md` — in the CI section, add one line documenting the new gate (what it covers, how to run locally: `corepack pnpm --filter @aivo/web-v2 run test:a11y`).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Locally: `corepack pnpm --filter @aivo/web-v2 run test:a11y` is **green** on the sprint branch (after EDIT-2 fixes), covering at minimum login + parent/learner/teacher homes + learner accessibility settings.
2. Negative proof: temporarily introduce a violation (e.g., remove the `aria-label` from a covered interactive element), run the suite → it **fails** with a serious/critical finding; revert → green again. Paste both outputs in the checkpoint summary.
3. Admin: `sprint12-e2e` compose lane green locally if runnable (`docker compose -f docker-compose.e2e.yml up` + the job's test command from `.github/workflows/ci.yml:742+`) or, if local Docker is unavailable, the three edited specs pass `tsc`/lint and the lane is verified in CI on the PR run.
4. Workflow lints clean (`actionlint` if available in repo tooling; otherwise YAML parses and the job appears in the PR checks list).
5. Note for the owner in the checkpoint: the new `web-a11y-axe` job must be added to branch-protection required checks (repo-settings action only the owner can take).

## Tests

- The new/edited specs **are** the tests. Additionally run the full existing suites to prove no regressions: `corepack pnpm --filter @aivo/web-v2 test` and `corepack pnpm --filter @aivo/web-v2 e2e` (or the subset CI runs, if the full e2e set needs services unavailable locally — state exactly which specs ran).

## Out of scope

- Fixing a11y issues on routes *not* in the coverage set (later sprints touch those surfaces and inherit the gate).
- Lighthouse a11y budgets (already exist via `lighthouserc.web-v2.json`), contrast tooling, mobile a11y (Sprint 04/05), visual-regression matrix (Sprint 15).

## Depends on

Nothing. Runs independently; do early so all later sprints inherit the gate.

## Checkpoint

Summarize: workflow diff, spec diffs, any real violations fixed (file:line each), the red/green negative-proof outputs, and the branch-protection note. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**
