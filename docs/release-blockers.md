# Release Blockers

This document tracks the categories of issue that are treated as **hard
production blockers** by the readiness gates in `scripts/`.

A blocker means: the merge to `main` and/or the production build is rejected
until the issue is resolved.

## Categories

1. **Hardcoded learner activities in production**
   * static `QUESTIONS` arrays driving the mobile/web learner stage
   * `generateDemoBeats()` invoked without an explicit dev/demo flag
   * `MOCK_QUESTIONS` or `mockQuestions` referenced by a production route
   * `demoLesson` / `DEMO_LESSON` fallbacks reachable in production

2. **Missing surface contracts**
   * baseline generator without a `LearnerSurfaceSpec`-shaped item contract
   * geometry baseline items that cannot request `geometry_workspace`
   * math computation items that cannot request `scratchpad`
   * tutor prompt builder missing the Surface Tool Protocol section
   * web `SurfaceResponseZone` not rendering via `SurfaceHost`
   * mobile stage without a real `sessionClient.getSession(...)` loader

3. **Stub or unfinished production code**
   * `throw new Error("not implemented")` reachable from a production path
   * `TODO production blocker` markers
   * `"coming soon"` strings used as functional return values

4. **Missing release infrastructure**
   * root `package.json` missing `build`, `lint`, or `test` scripts
   * `scripts/production-readiness-check.mjs`, `no-demo-prod-scan.mjs`, or
     `surface-contract-scan.mjs` missing or unreadable

## Severity Policy

* **Blocker** — fails CI when `NODE_ENV=production` or `--strict` is passed.
* **Warning** — printed but does not fail CI. Warnings should still be
  resolved before tagging a release.

## Triage Workflow

1. Run `pnpm prod:check` locally.
2. For any blocker that is genuinely development-only, gate the code behind
   one of the approved development flags (`__DEV__`, `demo=1`, or
   `AIVO_MOBILE_DEMO_STAGE === "true"`).
3. If a finding is a false positive, narrow the regex in
   `scripts/no-demo-prod-scan.mjs` — do **not** broaden the allowlist.
4. Re-run `pnpm test:production-readiness` to confirm the scanner still
   protects the original behavior.
