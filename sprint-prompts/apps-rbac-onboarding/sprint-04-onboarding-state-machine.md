# Sprint 04 — Explicit onboarding state machine and contributor branch

## Goal

At the end of this sprint, onboarding is a persisted, auditable state machine with legal transitions for add learner → parent assessment → contributor branch → baseline → clone → approval → PIN → learner app. The contributor-awaited branch follows the owner-approved policy instead of being implicit in ad-hoc readiness redirects.

## Context

Pillar: **onboarding state machine**.

Dual-stack reality: web-v2 currently derives readiness from records in `apps/web-v2/lib/learner/readiness.ts`; baseline completion and brain clone are web-v2 internal. This sprint does not move clone execution to `brain-svc`; it models the current runtime path honestly and creates integration points for future one-brain work.

Current verified evidence:
- `computeReadinessFor` derives state from learner, parent assessment, IEP, baseline, lesson count, and brain profile: `apps/web-v2/lib/learner/readiness.ts:108-122`.
- It treats baseline complete + cloned brain as `brain_clone_review_needed`: `apps/web-v2/lib/learner/readiness.ts:128-137`.
- After parent assessment, it checks `teamInviteDecision` (`done` or `skipped`) rather than actual awaited contributor state: `apps/web-v2/lib/learner/readiness.ts:148-156`.
- The report found baseline legal transition enforcement unverified and contributor behavior undefined.

Report mapping: closes **Gap 4 / R3** and formalizes Sprint 03's PIN-after-approval gate.

## Work orders

### DELETE

- Delete route-only or component-only onboarding ordering assumptions once state-machine preconditions replace them.
- Do not delete `computeReadinessFor` outright if it still powers badges; refactor it to read/state-map from the state machine or become a compatibility view.

### CREATE

- Create persistence for onboarding state, e.g. `learner_onboarding_state` and `onboarding_transitions`:
  - Current state.
  - Learner ID, tenant ID.
  - Last event, actor role/user ID.
  - Contributor policy fields: awaited roles, invited member IDs, deadline, parent override, completed contributors.
  - Timestamps and audit metadata.
- Create `advanceOnboarding(learnerId, event, actor, metadata)`:
  - Reject illegal transitions with typed errors.
  - Persist transition history.
  - Be idempotent for repeated events from retried requests.
- Create typed states at minimum:
  - `learner_created`.
  - `parent_assessment_in_progress`.
  - `parent_assessment_complete`.
  - `contributors_pending`.
  - `baseline_ready`.
  - `baseline_complete`.
  - `brain_clone_pending`.
  - `brain_review_required`.
  - `brain_approved`.
  - `pin_ready`.
  - `learner_app_open`.
- Create tests proving illegal transitions are rejected.

### REFACTOR

- Refactor parent assessment submission to emit `parent_assessment_submitted` and advance to either `contributors_pending` or `baseline_ready` based on the chosen contributor policy.
- Refactor team-invite decisions and contributor submissions to update contributor sub-state.
- Refactor baseline create/start/complete routes to require the proper onboarding state.
- Refactor brain clone commit/approval to advance to `brain_review_required` and `brain_approved`.
- Refactor PIN setup from Sprint 03 to require `brain_approved` / `pin_ready` state.
- Refactor `computeReadinessFor` and next-step mapping to reflect persisted onboarding state while preserving existing parent-facing labels where appropriate.

### EDIT

- Edit parent and learner UI redirects so they use state-machine next action, not inferred route order.
- Edit any tests that seeded only readiness strings to seed state-machine records or use helper factories.
- Edit documentation/comments around contributor invite step to describe the actual chosen branch policy.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **Credential & auth rules (any sprint touching PINs, sessions, or login):** no secret or PIN is ever stored or compared in plaintext — hash with Argon2id or scrypt and verify in constant time; the production service (identity-svc) owns hashing, verification, and server-side lockout (not client-only attempt counts); learner sessions carry a learner-scoped identifier, no adult capabilities, and a shorter lifetime; the PIN auth contract binds the selected `learnerId`.
- **Authorization rules (any sprint touching child-scoped routes):** enforcement is server-side on every endpoint (UI hiding is not a control); scope checks are role-aware (parent relationship / learner-self / accepted care-team membership / teacher roster), never "same-tenant existence"; add negative IDOR tests for caregiver, teacher, and therapist across brain, baseline, recommendations, lesson-run, observation, and learner-context routes.

## Definition of done

Report R3 build steps, verbatim:
1. Add an `onboarding_transitions` table and a `learner_onboarding_state` record with states such as `learner_created`, `parent_assessment_in_progress`, `parent_assessment_complete`, `contributors_pending`, `baseline_ready`, `baseline_complete`, `brain_clone_pending`, `brain_review_required`, `brain_approved`, `pin_ready`, `learner_app_open`.
2. Implement `advanceOnboarding(learnerId, event, actor)` in web-v2 or a dedicated onboarding service; reject illegal transitions with typed errors.
3. On parent assessment submission, emit `parent_assessment_submitted` and compute contributor policy. If no contributors are awaited, transition to `baseline_ready` immediately.
4. If contributors are awaited, implement the product policy chosen from the open questions: wait for all, wait until deadline, or proceed while accepting late input as future brain-change proposals.
5. Replace route-only readiness decisions with state-machine-backed redirects and BFF precondition checks.

Report R3 DoD, verbatim:
- Tests prove a learner cannot start baseline before parent assessment complete, cannot create PIN before the configured approval milestone, and contributor branches behave exactly as product specifies.

Exact verification commands:
- `corepack pnpm --filter @aivo/web-v2 test -- onboarding`
- `corepack pnpm --filter @aivo/web-v2 test -- readiness`
- `corepack pnpm --filter @aivo/web-v2 test -- baseline`
- `pnpm test`
- `rg -n "TODO|FIXME|stub|placeholder|mock|not implemented|coming soon" <changed production files>`

## Tests

Write or update:
- State-machine transition unit tests.
- Repository/persistence parity tests for memory and drizzle/postgres adapters.
- BFF precondition tests for baseline and PIN.
- Contributor branch tests for all owner-approved scenarios.
- UI next-step tests for parent learner detail/onboarding surfaces.

Run the full suite so Sprints 01–03 remain green.

## Out of scope

- Do not add the web login toggle; Sprint 05 owns it.
- Do not expand caregiver capabilities; Sprint 06 owns it.
- Do not rewrite brain cloning to call `brain-svc`; model the current stack honestly.

## Depends on

- Depends on Sprint 03 for the immediate PIN gate shape.
- Depends on Sprint 02 for any contributor/care-team child-scope checks used by contributor branch routes.
- Requires owner decision: contributor-awaited policy.
- Cross-track: coordinate with Assessment-UX orchestration hub/reminder work if present; this sprint owns legal state transitions, not contributor UX polish.

## Checkpoint

At sprint end, summarize the state graph, list all legal/illegal transition tests, call out the implemented contributor policy, and pause for owner review. Do not commit unless explicitly instructed.
