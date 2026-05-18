# AIVO_LMS Green Dashboard

> Sprint **GREEN-00** deliverable. Single source of truth for the
> production-readiness gate sequence. Re-run `pnpm green:check` to refresh.

**Branch:** `claude/aivo-lms-production-ready-h2gNJ`
**Snapshot taken:** 2026-05-18
**Overall status:** 🔴 RED

| # | Gate | Owner sprint | Status | Result |
|---|------|--------------|--------|--------|
| 1  | `pnpm install` | infra | 🟢 | clean install, 22.22 Node, pnpm 10.26 |
| 2  | `pnpm format:check` | GREEN-00 | 🔴 | 1458 files unformatted |
| 3  | `pnpm lint` | GREEN-00 | 🔴 | `@aivo/web-v2#lint` fails: root eslint config imports `@eslint/js` which is not in root devDeps |
| 4  | `pnpm test` | GREEN-00 | 🔴 | `@aivo/web-v2#test` has no test files (`vitest run` exits 1). Cascade kills observed on `stage-runtime` and `tutor-surface-protocol` (both pass in isolation). |
| 5  | `pnpm build` | GREEN-00 | 🔴 | `@aivo/marketing#build`: missing `@eslint/js` dep + TypeScript error `Property 'title' does not exist on type 'ComparisonSpec'` at `apps/marketing/src/app/compare/page.tsx:39:20`. Cascade fails on `@aivo/web` and `@aivo/web-v2`. |
| 6  | `pnpm api:check` | GREEN-00 | 🔴 | `services/identity-svc` cannot resolve `@aivo/sso/dist/index.js` (workspace package not built / missing main entry). OpenAPI dump aborts. |
| 7  | `pnpm prod:no-demo` | GREEN-00 | 🟢 | scanner passes |
| 8  | `pnpm prod:surface-contract` | GREEN-00 | 🟢 | scanner passes |
| 9  | `pnpm prod:check` | GREEN-00 | 🟢 | scanner passes |
| 10 | `pnpm test:production-readiness` | GREEN-00 | 🔴 | `vitest: not found` when invoked from root — vitest binary is not on root PATH because root `devDependencies` doesn't declare it. Script needs to use `pnpm exec vitest` or vitest must be added to root deps. |
| 11 | `pnpm test:enterprise` | GREEN-00 | 🔴 | same root cause as gate #10 |
| 12 | `pnpm i18n:audit` | GREEN-00 | 🔴 | 422 hard failures (missing/orphan keys), 271 untranslated warnings across web/marketing/mobile locales (ar/de/es/fr/hi/ja/ko/pt/zh). |
| 13 | `pnpm consent:audit` | GREEN-04 | 🟢 | existing scanner passes — sprint **GREEN-04** will harden the lens |
| 14 | `pnpm auth:audit` | GREEN-04 | 🟢 | existing scanner passes |
| 15 | `pnpm curriculum:validate` | GREEN-03 | 🟢 | existing scanner passes — sprint **GREEN-03** must verify it actually enforces the seeded K-8 graphs and not just stubs |
| 16 | `pnpm onboarding:audit` | GREEN-05 | 🟢 | scanner passes |
| 17 | `pnpm lessonrun:audit` | GREEN-05 | 🟢 | scanner passes |
| 18 | `pnpm route:audit` | GREEN-08 | 🟢 | scanner passes |
| 19 | `pnpm mobile:audit` | GREEN-07 | 🟢 | scanner passes — different lens from `mobile:role-audit` below |
| 20 | `pnpm marketing:audit` | GREEN-10 | 🟢 | scanner passes (but `marketing` build is still red — gate 5) |
| 21 | `pnpm billing:audit` | GREEN-11 | 🟢 | scanner passes |
| 22 | `pnpm rostering:audit` | GREEN-11 | 🟢 | scanner passes |
| 23 | `pnpm comms:audit` | GREEN-11 | 🟢 | scanner passes |
| 24 | `pnpm ai-safety:audit` | GREEN-06 | 🟢 | scanner passes |
| 25 | `pnpm accessibility:audit` | GREEN-09 | 🟢 | scanner passes (legacy lens; the GREEN-09 `a11y:audit` adds axe + keyboard + reduced-motion snapshots) |
| 26 | `pnpm brand:check` | GREEN-10 | 🟢 | scanner passes |
| 27 | `pnpm repo:health` | infra | ⚪ | not yet wired into green:check default run; verify in next iteration |
| 28 | `pnpm backend:parity` | GREEN-01 | ⚪ NOT IMPLEMENTED | `scripts/backend-parity-check.mjs` does not exist |
| 29 | `pnpm tutor:parity` | GREEN-02 | ⚪ NOT IMPLEMENTED | `scripts/tutor-parity-check.mjs` does not exist |
| 30 | `pnpm mobile:role-audit` | GREEN-07 | ⚪ NOT IMPLEMENTED | `scripts/mobile-role-audit.mjs` does not exist (separate lens from `mobile:audit`) |
| 31 | `pnpm ux:parity` | GREEN-08 | ⚪ NOT IMPLEMENTED | `scripts/ux-parity-check.mjs` does not exist |
| 32 | `pnpm a11y:audit` | GREEN-09 | ⚪ NOT IMPLEMENTED | distinct from existing `accessibility:audit`; new lens defined in GREEN-09 |
| 33 | `pnpm security:audit` | GREEN-12 | ⚪ NOT IMPLEMENTED | `scripts/security-audit.mjs` does not exist |
| 34 | `pnpm green:check` | GREEN-00 | 🟡 | **created in this sprint** — wraps all of the above |

## Summary counts (verified by `pnpm -w green:check --only-implemented`)

- **Required gates implemented:** 26
- **Required gates passing:** 18 / 26
- **Required gates failing:** 8 — `format:check`, `lint`, `test`, `build`, `api:check`, `test:production-readiness`, `test:enterprise`, `i18n:audit`
- **Sprint-owned gates not yet implemented:** 6 (GREEN-01..09 + GREEN-12)
- **Overall:** 🔴 RED — production blockers in core build/test/lint/api/i18n surface

## Honest scope note

Sprint **GREEN-00** delivers tooling and inventory only. Sprints **GREEN-01..12**
own the underlying remediations. See `red-to-green-backlog.md` for the
prioritized work list and `backend-parity-matrix.md`, `tutor-parity-matrix.md`,
`ux-parity-matrix.md` for the per-domain matrices.

No production-readiness scanner has been weakened or allowlisted to force green.
