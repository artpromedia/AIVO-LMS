# Production Readiness Gates

This repository enforces three layered production gates before any build can
ship.

## Gates

| Gate | Script | What it blocks |
|------|--------|----------------|
| **No-demo-prod scan** | `pnpm prod:no-demo` | Hardcoded demo questions, `generateDemoBeats()` outside dev guards, MOCK fallbacks, `TODO production blocker`, `throw new Error("not implemented")`, "coming soon" as a functional path |
| **Surface contract scan** | `pnpm prod:surface-contract` | Baseline generator missing a learner surface contract, geometry items unable to request `geometry_workspace`, math items unable to request `scratchpad`, tutor prompt missing the Surface Tool Protocol, web `SurfaceResponseZone` not using `SurfaceHost`, mobile learner stage hardcoding questions instead of loading a real session |
| **Aggregate readiness check** | `pnpm prod:check` | Runs both scanners plus structural checks (root build/lint/test scripts exist). Always exits non-zero when `NODE_ENV=production` and any blocker is found. |

## Running locally

```bash
pnpm prod:no-demo
pnpm prod:surface-contract
pnpm prod:check
pnpm test:production-readiness
```

## Failure semantics

* `NODE_ENV=production` (or `--strict`): blockers cause the script to exit `1`.
* Any other `NODE_ENV`: blockers are printed as warnings but the script
  exits `0` so engineers can iterate. CI uses `NODE_ENV=production`.

## Why hardcoded learner activities are blocked in production

The mobile learner stage previously rendered a fixed `QUESTIONS` array. In
production this:

* hides regressions in the lesson and baseline generators,
* prevents profile-aware surfaces (geometry, scratchpad, etc.) from being
  exercised,
* and lets stale demo content reach real learners.

These gates fail the build when a hardcoded demo path is left active without
an explicit development guard.

## Intentional demo mode in development

Demo flows are still permitted when **all** of the following are true:

* `__DEV__ === true`, **or**
* the route query string contains `demo=1`, **or**
* the environment variable `AIVO_MOBILE_DEMO_STAGE === "true"`.

Demo mode is unreachable when `NODE_ENV=production`.

A scanner-friendly inline comment, `// @allow-demo`, may be used on a single
line as a last-resort override. Use it sparingly and only with a reviewer's
sign-off — the line must still be unreachable in production.
