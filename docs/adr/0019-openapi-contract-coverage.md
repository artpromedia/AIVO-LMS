# 0019 — OpenAPI contract coverage gate

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Platform Engineering, API Working Group
- **Related:** `.github/workflows/production-gates.yml`
  (`api-client-drift-gate` job), `scripts/dump-openapi.mjs`,
  `.github/workflows/api-client-drift.yml`, Sprint 12 v1 cutover.

## Context

The `api-client-drift-gate` job in `.github/workflows/production-gates.yml`
runs `pnpm api:check`, which compares the checked-in TypeScript API client
against a freshly generated one from the live OpenAPI specs (see
`scripts/dump-openapi.mjs`).

At the time of v1 cutover (Sprint 12), several services in
`scripts/dump-openapi.mjs` still expose untyped Fastify routes — they
declare bodies as `any` or omit `response` schemas. Running the drift gate
in **blocking** mode today would produce noisy diffs that are not actually
client-breaking, just under-typed.

For that reason, the job currently sets `continue-on-error: true` and runs
as an **advisory** signal. This ADR records the explicit conditions under
which the gate flips to blocking.

## Decision

The `api-client-drift-gate` job becomes a **blocking** production gate
(`continue-on-error` removed) when **all** of the following are true:

1. Every service enumerated in `scripts/dump-openapi.mjs` declares typed
   `body`, `querystring`, `params`, and `response` schemas on every
   non-internal route.
2. `pnpm api:check` produces no diff for two consecutive weeks on `main`.
3. The generated client lives under `packages/api-client/` and is
   referenced by `apps/web-v2`, `apps/marketing`, and the mobile workspace
   without ad-hoc `fetch()` overrides.
4. A new audit script (`scripts/api-contract-coverage.mjs`) reports
   100% coverage on the route inventory.

When all four are satisfied, open a PR that:

- removes the `continue-on-error: true` line from
  `.github/workflows/production-gates.yml`;
- removes the `# Will become blocking once …` comment above the job;
- updates this ADR with status `Superseded by 00XX` (or `Completed` with
  the commit SHA of the cutover).

## Consequences

**Positive**

- Untyped routes can land during the v1 push without blocking unrelated PRs.
- The expectation is recorded in code review: every new route under
  `services/*` is expected to be typed end-to-end.

**Negative / risks**

- Drift can creep in while the gate is advisory. To mitigate, the existing
  `.github/workflows/api-client-drift.yml` job posts a PR comment summary
  whenever the generated client changes.
- The advisory state risks becoming permanent. The Sprint 13 plan owns
  the route-typing backlog and references this ADR.

## Status check

- [ ] Item 1 — typed Fastify schemas on every service
- [ ] Item 2 — two clean weeks on `main`
- [ ] Item 3 — single generated client consumed by all front-ends
- [ ] Item 4 — `scripts/api-contract-coverage.mjs` reports 100%

When all four boxes are checked, file the un-pin PR.
