# AIVO_LMS Red → Green Backlog

> Sprint **GREEN-00** deliverable. Prioritized list of every gap that
> currently keeps the repo from being 100% green. Items are categorized
> P0 (production blocker), P1 (release blocker), P2 (parity gap),
> P3 (polish). Each item lists the owning sprint.

## P0 — Production blockers (block merge / release / pilot)

| ID | Item | Owner sprint | Evidence |
|----|------|--------------|----------|
| P0-001 | Root `eslint.config.mjs` imports `@eslint/js` but the package is not in root `devDependencies` (only in `packages/learner-surfaces`). Breaks `apps/web-v2 lint` and `apps/marketing build`. | GREEN-00 hot-fix | `pnpm lint` → `Cannot find package '@eslint/js'` |
| P0-002 | `@aivo/marketing#build` TypeScript error: `Property 'title' does not exist on type 'ComparisonSpec'` at `apps/marketing/src/app/compare/page.tsx:39:20`. | GREEN-00 hot-fix | `pnpm build` log |
| P0-003 | `services/identity-svc` cannot resolve `@aivo/sso/dist/index.js` — workspace package missing built main entry. Breaks `pnpm api:dump` → `pnpm api:check`. | GREEN-00 hot-fix / GREEN-01 | `pnpm api:check` stack trace |
| P0-004 | `@aivo/web-v2` test script is `vitest run` but no test files exist; gate exits 1. Either add tests or scope the script to existing tests. | GREEN-00 / GREEN-08 | `pnpm test` → `No test files found` |
| P0-005 | Turbo cascade kills cause `stage-runtime` and `tutor-surface-protocol` tests to report failed during a full `pnpm test` while passing in isolation. Investigate whether this is a real flake or solely a consequence of P0-001/P0-004. Likely vanishes once P0-001/P0-004 are fixed; verify, do not assume. | GREEN-00 | `pnpm test` log vs. direct `pnpm --filter @aivo/stage-runtime test` |
| P0-006 | `test:production-readiness` and `test:enterprise` scripts fail with `vitest: not found` from the root because `vitest` is not on the root binstub PATH. Fix: declare `vitest` in root `devDependencies` or change the scripts to `pnpm exec vitest run ...`. | GREEN-00 hot-fix | `pnpm green:check` log |

## P1 — Release blockers (must be fixed before pilot)

| ID | Item | Owner sprint | Evidence |
|----|------|--------------|----------|
| P1-101 | 1458 files fail `pnpm format:check`. Risk: hides real diffs in code review. | GREEN-00 | `prettier --check` warns 1458× |
| P1-102 | `i18n:audit` reports 422 hard missing/orphan keys across web (42 missing in 9 locales) and mobile (44 missing in es). | GREEN-00 / GREEN-09 | `pnpm i18n:audit` log |
| P1-103 | `i18n:audit` reports 271 untranslated warnings across marketing locales. | GREEN-00 | same |
| P1-104 | `pnpm test:production-readiness` and `pnpm test:enterprise` not yet exercised by `green:check`; need to be wired in once P0-001..P0-004 unblock the core gates. | GREEN-00 follow-up | dashboard gates #10–#11 |
| P1-105 | Running `pnpm api:generate` regenerates **9 openapi snapshots and 9 generated TS clients** with diffs vs. committed state (admin-svc, assessment-svc, billing-svc, engagement-svc, family-svc, integrations-svc, learning-svc, research-svc, tutor-svc) — indicates committed clients are stale. Independent of P0-003, fixing identity-svc will expose this drift directly. Reproduce: `pnpm api:generate && git status -- packages/api-client`. Snapshots intentionally **not** committed in this GREEN-00 commit so the drift remains visible. | GREEN-01 | observed during GREEN-00 baseline run |

## P2 — Parity / missing-gate gaps (own each in its sprint)

| ID | Item | Owner sprint |
|----|------|--------------|
| P2-201 | `pnpm backend:parity` script + matrix-driven enforcement does not exist. Requires real persistence/route/test verification, not type-only. | GREEN-01 |
| P2-202 | `pnpm tutor:parity` script + per-tutor matrix does not exist. Must verify runtime, persona, surface, avatar, voice, safety, analytics, and tests for all 14 tutors. | GREEN-02 |
| P2-203 | Curriculum is currently passing `curriculum:validate`; GREEN-03 must verify the scanner actually exercises real seeded K-8 graphs in Math / Reading / Science / Writing, not stubs. | GREEN-03 |
| P2-204 | Server-side consent middleware coverage, IEP guard, raw-IEP leak prevention to learner UI need positive integration tests beyond the current scanner. | GREEN-04 |
| P2-205 | Core learner loop (parent assessment → brain profile → baseline → mastery → Today's Mission → LessonRun → parent summary) must be verified end-to-end with no static mock baseline reachable in prod. | GREEN-05 |
| P2-206 | AI safety / quality / cost gate harness, eval rubrics, fallback metrics, admin cost dashboard. | GREEN-06 |
| P2-207 | `pnpm mobile:role-audit` script and unified RoleContext + role chooser + role-pill flow do not yet exist as enforced gates. | GREEN-07 |
| P2-208 | `pnpm ux:parity` script + per-role design-system parity matrix + visual regression baseline absent. | GREEN-08 |
| P2-209 | `pnpm a11y:audit` (axe + keyboard + screen reader + reduced-motion snapshots) distinct from existing `accessibility:audit` not yet implemented; WCAG/VPAT docs not yet authored. | GREEN-09 |
| P2-210 | Marketing trust pages need scrub for fake testimonials/logos and unsupported compliance claims. | GREEN-10 |
| P2-211 | Server-side entitlement enforcement, OneRoster import, notification preference enforcement integration tests. | GREEN-11 |
| P2-212 | `pnpm security:audit`, threat model, incident response, key rotation, backup/restore drill not yet wired. | GREEN-12 |

## P3 — Polish

| ID | Item | Owner sprint |
|----|------|--------------|
| P3-301 | `next lint` deprecation warning on `@aivo/web-v2#lint` — migrate to ESLint CLI per Next.js 16 guidance. | GREEN-08 |
| P3-302 | `pnpm repo:health` not yet wired into `green:check`; verify it should be a required gate or note it as advisory. | GREEN-00 follow-up |
| P3-303 | pnpm reports ignored build scripts (`dtrace-provider`, `unrs-resolver`); decide whether to approve. | GREEN-12 |

## Notes on items NOT changed in GREEN-00

- No production-readiness scanner was weakened to clear a finding.
- No "coming soon" routes were silenced.
- No placeholder content was substituted for real implementation.
- All P2 items remain owned by their named sprint and are intentionally not
  fixed here — Sprint GREEN-00 is tooling and inventory only.

## How to refresh this backlog

```bash
pnpm green:check 2>&1 | tee /tmp/green-baseline.log
# review failing gates, update dashboard + backlog
```
