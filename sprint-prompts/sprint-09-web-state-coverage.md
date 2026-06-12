# Sprint 09 — Web state coverage: skeletons where users wait, 404s that keep their chrome, a signup that explains itself

## Goal

At the end of this sprint, the heaviest web-v2 routes show **layout-preserving skeletons** while loading, hitting a bad URL inside a role area shows a 404 **with that role's navigation chrome** (today it's a bare white page), the caregiver/therapist route groups stop being the only areas with zero state files, and **signup validates inline per field with an always-enabled submit** instead of today's silently-disabled "dead button". Closes audit gap **M2 (⚠️)** — verified baseline: 138 pages vs 6 `loading.tsx`, 8 `error.tsx`, 5 `not-found.tsx`.

## Context

- **Why 404s lose chrome (verified):** there are **no role-group `layout.tsx` files** (`app/parent/layout.tsx` etc. do not exist); chrome is applied per-page by `AppShell` — an **async server component reading the session** (`apps/web-v2/components/layout/app-shell.tsx:157`). `not-found.tsx` files exist for parent/learner/teacher but render without any shell. The root `app/not-found.tsx` is deliberately request-free ("static, to avoid cookie-read errors" — its own comment). Therefore: do **not** try to reuse the session-reading `AppShell` in not-found contexts; build a static chrome variant. Role nav configs are static data: `PARENT_NAV` etc. in `apps/web-v2/components/layout/role-shells.tsx` (imported by pages — verify the exact export site and reuse).
- **Existing state files (complete verified list):** `loading.tsx` × 6 (`learner`, `messages`, `notifications`, `parent`, `parent/home-v2`, `teacher`); `error.tsx` × 8 (root, `global-error`, `learner`, `messages`, `notifications`, `parent`, `parent/home-v2`, `teacher`); `not-found.tsx` × 5 (root, `learner`, `parent`, `parent/home-v2`, `teacher`). **Caregiver and therapist groups have none.** The generic group skeletons are minimal (e.g., `app/parent/loading.tsx` is a 10-line two-bar placeholder); the gold standard to imitate is `app/parent/home-v2/loading.tsx:10-64` (hero + track + grids, CLS-safe).
- **Skeleton primitives:** `apps/web-v2/components/ui/skeleton.tsx` (app-level) and `packages/ui/src/states/Skeleton.tsx` — use the app-level one for route files.
- **Signup (verified):** `apps/web-v2/app/signup/page.tsx` — client page; `canSubmit` gate at `:48` (`name.trim().length > 1 && /.+@.+\..+/.test(email) && password.length >= 8`), submit `disabled={!canSubmit}` at `:120`; server action `registerAction` (from `@/lib/auth/auth-actions`) redirects back with `?error=` codes (`SIGNUP_ERROR_CODES`, `:27-34`); inputs are `AuthInput` from `@aivo/ui/auth` — check whether `AuthInput` already supports `error`/`aria-describedby` props before extending it. The login page's error mapping (`app/login/page.tsx:135-157`) is the copy-register reference.
- **Heavy routes needing `loading.tsx`** (pick exactly these; each must mirror its page's real layout): `parent/learners/[learnerId]`, `parent/learners/[learnerId]/gradebook`, `parent/learners/[learnerId]/brain-profile`, `parent/learners/[learnerId]/lessons`, `parent/reports`, `parent/settings/billing`, `learner/progress`, `learner/library`, `learner/rewards`, `teacher/classes/[classId]`, `teacher/learners/[learnerId]`, `caregiver` (group root), `therapist` (group root). (13 files; if a listed page is a fast pure-static render, say so in the checkpoint instead of adding noise — justify any omission.)
- **A11y invariants:** skeleton containers `aria-busy="true"` with an `sr-only` loading message (existing house pattern — see `parent/home-v2/loading.tsx`); error pages keep the calm, no-blame copy register; everything through i18n (10 catalogs).

## Work orders

### DELETE
- None.

### CREATE
1. `apps/web-v2/components/layout/static-role-shell.tsx` — **cookie-free** presentational shell: wordmark, the role's nav links (from the same static nav configs pages use), `<main id="main">` slot. Accepts `role: "parent" | "learner" | "teacher" | "caregiver" | "therapist"`. No session reads, no async — safe in `not-found.tsx`/`error.tsx` contexts.
2. `apps/web-v2/components/ui/page-skeleton.tsx` — `PageSkeleton({ variant })` with variants `"detail" | "table" | "cards" | "feed"` composed from `components/ui/skeleton.tsx`, each `aria-busy` + `sr-only` label. Unit test with render assertions per variant.
3. The 13 route `loading.tsx` files (list above) using `PageSkeleton` with the variant matching each page's real structure (open each page first; a table page gets `table`, etc.).
4. State files for the uncovered groups: `app/caregiver/{error,loading,not-found}.tsx` and `app/therapist/{error,loading,not-found}.tsx`, following the parent/teacher patterns (calm copy, retry + home CTAs), wrapped in `StaticRoleShell`.
5. `apps/web-v2/e2e/role-chrome-states.playwright.ts` — `@a11y`-tagged: for parent/learner/teacher, navigate to `/<role>/learners/does-not-exist` (or the group's equivalent bad path) and assert the role nav links are present on the 404 + axe pass; assert the signup inline-validation behavior (below).

### REFACTOR
1. Existing `not-found.tsx` for `parent`, `learner`, `teacher` (and `parent/home-v2`) — wrap content in `StaticRoleShell` so the audit's bare-white-404 (shot 15-parent-404) is gone. Keep their existing copy/CTAs.
2. Existing thin group `loading.tsx` files (`parent`, `learner`, `teacher`) — upgrade to `PageSkeleton` variants that resemble those groups' home layouts.
3. `apps/web-v2/app/signup/page.tsx` —
   - submit button **always enabled**; on submit with invalid fields, prevent the action call and show per-field inline errors;
   - per-field validation on blur *and* on submit: name (≥ 2 chars), email (format), password (≥ 8 chars, mirroring `registerAction`'s real server rule — read `lib/auth/auth-actions.ts` and match exactly so client and server never disagree);
   - each error rendered inline under its `AuthInput`, associated via `aria-describedby`, field `aria-invalid`; first invalid field receives focus on failed submit;
   - server-side `?error=` banner behavior unchanged (it covers email-taken/service errors the client can't know);
   - if `AuthInput` (`packages/ui/src/auth/`) lacks error-display props, extend it there (keep API additive) — login and other `AuthInput` consumers must be unaffected (grep consumers and run their specs).

### EDIT
1. i18n: new keys for field errors + loading `sr-only` labels + caregiver/therapist state pages, in all 10 catalogs.
2. `apps/web-v2/e2e/identity-a11y.playwright.ts` (or the existing signup-covering spec — locate it) — extend to assert `aria-describedby` wiring on an invalid submit.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Manual: `/parent/learners/does-not-exist` shows the 404 **inside parent chrome** (nav visible, skip link works); same class of check for learner + teacher; caregiver/therapist roots have working loading/error/404 states.
2. Throttle the network (DevTools Slow 3G): the 13 routes show structure-matched skeletons, no layout jump when content lands (spot-check 3 and screenshot).
3. Signup: typing an invalid email and tabbing away shows the inline message; submit stays enabled; submitting focuses the first invalid field; screen reader announces via the described-by association (axe + manual check); valid submit still reaches `registerAction` and onboarding.
4. Counts moved (report in checkpoint): `find apps/web-v2/app -name loading.tsx | wc -l` ≥ 19; `not-found.tsx` ≥ 7; `error.tsx` ≥ 10.
5. Commands green: web-v2 `typecheck`, `lint`, `test`, `exec playwright test role-chrome-states identity-a11y`, `run test:a11y`, `node scripts/ci/check-i18n-coverage.mjs`.

## Tests

- New: `page-skeleton` unit tests, `role-chrome-states.playwright.ts`.
- Update: signup-related specs, visual snapshots only if a covered page is in the visual suite.
- Full web-v2 suite green.

## Out of scope

- Introducing role-group `layout.tsx` files (an architectural migration with redirect/streaming implications — decision-gated; the static shell solves the user-facing problem now). Toast adoption beyond what Sprint 08 shipped. Admin states (Sprint 10). Suspense/streaming strategy. Mobile.

## Depends on

**Sprint 08** (uses its toast/announcement layer where error states offer retry feedback; also avoids merge conflicts in shared files).

## Checkpoint

Summarize: new/updated state files (tree view), the static-shell approach and why `AppShell` wasn't reused (cookie-safety), signup before/after behavior, state-file counts before/after, DoD outputs + screenshots. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**
