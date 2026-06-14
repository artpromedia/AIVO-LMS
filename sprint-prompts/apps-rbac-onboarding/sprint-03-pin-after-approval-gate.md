# Sprint 03 — Gate PIN activation and learner app entry on parent-approved brain

## Goal

At the end of this sprint, a parent cannot create/activate a learner PIN or open the learner app for a child until the child's cloned learning brain has been reviewed and approved. The existing server-side lesson teach gate remains intact, but the child no longer reaches a confusing pre-approval learner-app dead end.

## Context

Pillars: **onboarding orchestration**, **brain approval reconciliation**, and **learner-PIN auth**.

Dual-stack reality: `apps/web-v2` currently owns the live parent/learner brain profile and lesson flow; `services/brain-svc` may be touched by Assessment-UX one-gate work, but this sprint uses the current web-v2 profile state as the runtime precondition. Do not redesign the full approval ceremony here; Assessment-UX C-06/C-12 may own that ceremony. This sprint adds the immediate safety gate that R4 says can ship before the full state machine.

Current verified evidence:
- Lesson creation already refuses unapproved brains: `apps/web-v2/lib/db/repos.ts:2753-2763`.
- Web PIN setup posts directly to `/api/bff/learners/${learnerId}/pin`: `apps/web-v2/app/onboarding/pin/page.tsx:32-37`.
- It routes to `/onboarding/parent-verify`, not learner handoff: `apps/web-v2/app/onboarding/pin/page.tsx:30` and `apps/web-v2/app/onboarding/pin/page.tsx:102-103`.
- The PIN BFF authorize helper requires only parent role and learner scope: `apps/web-v2/app/api/bff/learners/[learnerId]/pin/route.ts:22-30`.

Report mapping: closes **Gap 3 / R4** and the report's single most important finding. It also prepares Sprint 04 to formalize this as a state-machine transition.

## Work orders

### DELETE

- Delete any UI path or link that presents PIN setup as available before brain approval.
- Delete any client-only assumption that disabled buttons are sufficient gating for PIN setup.

### CREATE

- Create a server-side precondition helper in web-v2, for example `requireApprovedBrainForPin(session, learnerId, requestId)`:
  - Fetch the learner brain profile via the existing repository.
  - Require `cloneStage === "approved"`.
  - Return 409/412 with stable code `brain_not_approved` or `pin_requires_brain_approval` when blocked.
  - Include enough response data for UI to route the parent to the review surface.
- Create tests for `POST /api/bff/learners/[learnerId]/pin`:
  - no profile → blocked.
  - `pre_clone` → blocked.
  - `cloned` → blocked.
  - `approved` → succeeds.
- Create mobile tests or component assertions proving learners without approved brain/PIN are not shown as ready-to-login, or show a parent-facing setup-needed message.

### REFACTOR

- Refactor `apps/web-v2/app/api/bff/learners/[learnerId]/pin/route.ts`:
  - Keep parent role + learner ownership checks.
  - Add approved-brain precondition before setting the PIN.
  - Preserve Sprint 01 secure identity-svc PIN write path.
- Refactor web onboarding/readiness CTAs:
  - Move the primary PIN CTA to the brain approval success/next-step state.
  - If a parent navigates directly to `/onboarding/pin?learnerId=...` before approval, render a clear blocked state and link to the brain review page.
- Refactor mobile learner-login/profile list to avoid presenting a learner as PIN-login-ready unless PIN is set and brain approval is complete, using an existing or new BFF readiness endpoint.

### EDIT

- Edit `apps/web-v2/app/onboarding/pin/page.tsx` to handle the new server error:
  - Show parent-safe copy.
  - Link to `/parent/learners/{learnerId}/brain-clone-watch` or the current approved review route.
  - Do not allow skip to imply learner app access.
- Edit i18n message catalogs for any new user-facing copy.
- Edit docs/comments that currently say PIN is merely after parent account setup so they state the approved-brain precondition.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **Credential & auth rules (any sprint touching PINs, sessions, or login):** no secret or PIN is ever stored or compared in plaintext — hash with Argon2id or scrypt and verify in constant time; the production service (identity-svc) owns hashing, verification, and server-side lockout (not client-only attempt counts); learner sessions carry a learner-scoped identifier, no adult capabilities, and a shorter lifetime; the PIN auth contract binds the selected `learnerId`.
- **Authorization rules (any sprint touching child-scoped routes):** enforcement is server-side on every endpoint (UI hiding is not a control); scope checks are role-aware (parent relationship / learner-self / accepted care-team membership / teacher roster), never "same-tenant existence"; add negative IDOR tests for caregiver, teacher, and therapist across brain, baseline, recommendations, lesson-run, observation, and learner-context routes.

## Definition of done

Report R4 DoD, verbatim:
- There is no path where a child enters the learner app and then immediately hits an avoidable trust-gate failure because the parent has not approved the brain.

Report R4 build steps, verbatim to preserve scope:
1. Add a server-side precondition in `POST /api/bff/learners/[learnerId]/pin`: fetch brain profile and require `cloneStage === "approved"`; otherwise return 409/412 with `brain_not_approved`.
2. Move PIN CTA to the brain approval success state, not generic onboarding.
3. Change successful PIN save to route to learner app handoff (`/learner/select/auto?learnerId=...` on web; learner app home on mobile) only after session handoff is valid.
4. In mobile, hide learner profiles without active PIN/approved brain or show parent-facing setup message.
5. Add tests that unapproved cloned brain cannot create PIN, approved brain can, and lesson-start still rejects any unapproved state.

Exact verification commands:
- `corepack pnpm --filter @aivo/web-v2 test -- pin`
- `corepack pnpm --filter @aivo/web-v2 test -- lesson`
- `corepack pnpm --filter @aivo/mobile test`
- `pnpm test`
- `rg -n "TODO|FIXME|stub|placeholder|mock|not implemented|coming soon" <changed production files>`

## Tests

Write or update:
- BFF route tests for PIN gate states.
- Web UI tests for blocked direct `/onboarding/pin` navigation.
- Mobile learner-login tests for approved/PIN-ready filtering or messaging.
- Regression test proving `createLessonRun` still returns `brain_not_approved` pre-approval.

Run the full suite so Sprints 01–02 remain green.

## Out of scope

- Do not design the full onboarding state table; Sprint 04 owns it.
- Do not implement the web login toggle; Sprint 05 owns it.
- Do not change the approval ceremony beyond checking current approved state.
- Do not grant caregiver approval authority; Sprint 06 and owner decisions govern that.

## Depends on

- Depends on Sprint 01 for secure PIN write path.
- Should depend on Sprint 02 before exposing new child-scoped endpoints; this sprint only tightens parent-owned PIN setup.
- Cross-track: coordinate with Assessment-UX C-06/C-12 if brain approval route names or profile contracts changed.

## Checkpoint

At sprint end, summarize gate behavior for each brain state, list tests, and pause for owner review. Do not commit unless explicitly instructed.
