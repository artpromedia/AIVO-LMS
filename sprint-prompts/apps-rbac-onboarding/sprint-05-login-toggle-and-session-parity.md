# Sprint 05 — Web/mobile login toggle and learner-session parity

## Goal

At the end of this sprint, both web and mobile login screens present the same explicit choice: **Learner — PIN only** or **All other users — standard authentication**. Learner PIN login uses the secure selected-learner contract from Sprint 01, establishes learner-only sessions, and cannot reach adult capabilities.

## Context

Pillars: **authentication model**, **app topology**, and **role routing**.

Dual-stack reality: identity-svc owns secure PIN verification after Sprint 01; web-v2 owns browser session cookies and role routing; mobile owns native token storage and root routing. Do not implement this before Sprint 01, because the current identity-svc path compares plaintext PINs.

Current verified evidence:
- Web login form is adult-only and includes hidden `role=parent`: `apps/web-v2/app/login/_components/login-form.tsx:68-70`.
- Web login redirects adult users to `ROLE_HOME[profile.role]`: `apps/web-v2/app/login/page.tsx:99-100` in the report.
- Mobile adult login has a learner PIN button rather than a full toggle: `apps/mobile/app/(auth)/login.tsx:317-323`.
- Mobile PIN auth previously posted `{ parentId, pin }`; Sprint 01 should have changed this to `{ parentId, learnerId, pin }`.

Report mapping: closes **Gap 5 / R5**, completes the user-facing portion of **Gap 6**, and covers capability cells **web login toggle ⬜**, **mobile login toggle 🟡**, **adult role routing 🟡**, and remaining **learner session scoping 🟡**.

## Work orders

### DELETE

- Delete web login's assumption that the only login mode is adult email/password with hidden `role=parent`.
- Delete mobile's learner PIN as a secondary afterthought link if the new toggle replaces it; do not leave duplicate/confusing affordances.
- Delete any role-switch UI/capability exposure for learner sessions.

### CREATE

- Create a web learner-login component under `apps/web-v2/app/login/` or `_components/`:
  - Family/parent identifier step.
  - Learner selection step using a privacy-safe endpoint.
  - PIN pad/entry step using the secure identity-svc contract through a BFF proxy or server action.
  - Error states for locked PIN, wrong PIN, setup incomplete, brain not approved, no PIN set.
- Create or extend a web BFF route/server action to call identity-svc `/api/auth/pin-login` and set learner session cookies from the returned token/profile.
- Create mobile toggle UI equivalent in `apps/mobile/app/(auth)/login.tsx` while preserving deep links to learner login.
- Create route/session tests proving learner sessions cannot reach parent/teacher/therapist/caregiver capabilities.

### REFACTOR

- Refactor `apps/web-v2/app/login/page.tsx` and `LoginForm` into two modes/tabs:
  - `Learner — PIN only`.
  - `Parent, teacher, therapist, caregiver — email/password/SSO/MFA`.
- Refactor adult login copy to avoid implying only parents use it.
- Refactor mobile `login.tsx`, `learner-login.tsx`, and `pin.tsx` so the toggle mental model and selected-learner contract are consistent.
- Refactor session decoding/mapping if needed so learner sessions carry a learner-scoped identifier (`session.learnerId`) and no adult permissions/capabilities.

### EDIT

- Edit all 10 web i18n catalogs and mobile i18n files for new login labels/errors.
- Edit tests for role homes/redirects to include learner PIN login.
- Edit docs/help text so parents understand learner PIN is for the child, adult auth is for everyone else.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **Credential & auth rules (any sprint touching PINs, sessions, or login):** no secret or PIN is ever stored or compared in plaintext — hash with Argon2id or scrypt and verify in constant time; the production service (identity-svc) owns hashing, verification, and server-side lockout (not client-only attempt counts); learner sessions carry a learner-scoped identifier, no adult capabilities, and a shorter lifetime; the PIN auth contract binds the selected `learnerId`.
- **Authorization rules (any sprint touching child-scoped routes):** enforcement is server-side on every endpoint (UI hiding is not a control); scope checks are role-aware (parent relationship / learner-self / accepted care-team membership / teacher roster), never "same-tenant existence"; add negative IDOR tests for caregiver, teacher, and therapist across brain, baseline, recommendations, lesson-run, observation, and learner-context routes.

## Definition of done

Report R5 build steps, verbatim:
1. Web `/login`: add a two-tab/toggle control: `Learner` and `Parent / teacher / therapist / caregiver`. Learner tab renders family/learner selector + PIN entry and calls a BFF proxy to identity-svc `/api/auth/pin-login`.
2. Adult tab keeps existing email/password/SSO/MFA path.
3. On mobile, convert the current “Learner PIN Login” link into the same explicit toggle affordance while preserving deep links.
4. Ensure learner sessions carry role `LEARNER`, a learner identifier claim, no adult capabilities, shorter session lifetime, and role switcher disabled.
5. Add route tests: learner token cannot reach parent/teacher/therapist/caregiver BFF routes; adult token cannot use PIN-only endpoints; wrong role redirects to `ROLE_HOME`.

Report R5 DoD, verbatim:
- Both web and mobile present the same mental model: “Learner — PIN only” vs “All other users — standard authentication.”

Exact verification commands:
- `corepack pnpm --filter @aivo/web-v2 test -- login`
- `corepack pnpm --filter @aivo/web-v2 test -- auth`
- `corepack pnpm --filter @aivo/mobile test`
- `corepack pnpm --filter @aivo/identity-svc test`
- `pnpm test`
- `rg -n "TODO|FIXME|stub|placeholder|mock|not implemented|coming soon" <changed production files>`

## Tests

Write or update:
- Web login UI tests for both toggle modes.
- Web BFF/session tests for learner PIN login and adult login separation.
- Mobile login screen tests for toggle affordance.
- Route authorization tests proving learner token cannot access adult capabilities.
- Regression tests for adult SSO/MFA/password login.

Run the full suite so Sprints 01–04 remain green.

## Out of scope

- Do not change PIN storage/verification; Sprint 01 owns it.
- Do not change onboarding legal transitions; Sprint 04 owns it.
- Do not build caregiver capabilities; Sprint 06 owns it.

## Depends on

- Depends on Sprint 01 secure PIN auth.
- Should follow Sprint 03/Sprint 04 so login can represent setup-incomplete/approval-needed states accurately.
- Cross-track: coordinate with any authentication/session changes from platform tracks.

## Checkpoint

At sprint end, summarize web and mobile login behavior, list learner/adult session assertions, include tests, and pause for owner review. Do not commit unless explicitly instructed.
