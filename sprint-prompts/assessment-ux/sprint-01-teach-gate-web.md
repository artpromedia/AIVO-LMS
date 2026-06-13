# Sprint C-01 — Server-side teach-gate in web-v2 (nothing teaches from an unapproved brain)

**Stack:** `apps/web-v2` only.
**Report items closed:** Top 10 **#1**; roadmap Quick-win row "Server-side approval gate"; the first of the report's "three things that most undermine parent trust" (§1.1). Also carries the ❓-appendix **runtime verification** rider (this is the first sprint that runs the app) and the ❓ "mobile parent assessment rendering" viewport check.

## Goal

At the end of this sprint, a learner whose brain profile has not been parent-approved **cannot have a lesson created or served** in web-v2 — enforced in the server-side lesson pipeline (not UI routing), surfaced as a typed `brain_not_approved` blocker with kind learner-facing copy, and proven by regression tests against every code path that creates lessons. The product's central promise ("nothing teaches from the brain before approval") becomes a guarantee instead of a navigation convention.

## Context

Written for a session with zero prior knowledge:

- **Architecture:** web-v2 (Next.js App Router) owns its own persistence (`apps/web-v2/lib/db/repos.ts`, adapters under `lib/db/persistence/`). It is the live parent/learner surface. A parallel Python `services/brain-svc` exists but is NOT what this sprint touches — its approve endpoint already gates implicitly (paths init only on approve, `services/brain-svc/src/brain_svc/routes/brain.py:478-498`). The broken gate is in web-v2.
- **The audited defect** (report §4.1 point 5, all citations re-verified at HEAD `32ece1d3`):
  - `completeBaseline` builds the mastery map **and the learning path at baseline completion — before approval** (`apps/web-v2/lib/db/repos.ts:1378-1421`), then commits the brain clone in `cloned` (pending review) stage.
  - `pickTodaysMission` checks only that a learning path + mastery map exist (`apps/web-v2/lib/learner/today.ts:215-218`); it never reads the brain profile.
  - `createLessonRun` requires only that a brain profile **exists** (`repos.ts:1885-1892`, error code `brain_profile_missing`) and then snapshots the **unapproved** state into the lesson: `brainStateSnapshot: brain.state` (`repos.ts:1945`).
  - `POST /api/bff/learners/[learnerId]/today/start` guards session, role, learner scope, rate limit, and under-13 consent (`app/api/bff/learners/[learnerId]/today/start/route.ts:26-44`) — the consent guard is real but checks *onboarding* consent (`child_data_collection`, `ai_personalization`), not brain approval.
  - The only approval enforcement is UI routing: `computeReadinessFor` returns `brain_clone_review_needed` for `cloneStage === "cloned"` (`apps/web-v2/lib/learner/readiness.ts:128-146`).
- **The lifecycle states:** `LearnerBrainProfile.cloneStage` ∈ `pre_clone | cloned | approved` (`lib/db/types.ts:476`); `approveBrainClone` flips to `approved` (`repos.ts:715-732`); `upsertBrainProfile` (regenerate) resets to `pre_clone` (`repos.ts:564-576`).
- **Existing test to mirror:** `apps/web-v2/lib/learner/readiness.brain-build.test.ts` sets persistence state directly (learner + completed baseline + a brain profile at a chosen `cloneStage`) and asserts each branch deterministically — the report's DoD names this file as the pattern.
- **Behavior change to flag (Decision D8, default YES):** teacher-assigned missions currently surface even pre-baseline (`today.ts:170-173`) and create lessons through the same `createLessonRun` — under this gate they are blocked pre-approval too, because they snapshot the same unapproved brain state. The teacher-assignment UI must show the same waiting state, and the Checkpoint must call this change out for owner review.
- **Cross-track:** functional Suite A sprints 06/07 add a Sunday creator job that pre-generates lessons via `createLessonRun`. If those sprints have landed in this tree, verify the job handles `brain_not_approved` by **skipping that learner with a structured log** — never crashing the fleet run.
- **Persona/bar:** the blocked learner is a child; the blocking copy must be calm and blame-free (Khan Academy Kids bar), e.g. the report's "waiting for your grown-up to say go" framing — final copy via i18n.

## Work orders

### DELETE
- None.

### CREATE
1. `apps/web-v2/lib/db/__tests__/lesson-gate.brain-approval.test.ts` — the gate's regression suite (see **Tests**).
2. i18n keys (in `apps/web-v2/lib/i18n/messages/en.json`, mirrored to all 10 locales per Decision D7): a learner-safe blocked-state message under the learner-home namespace (calm, no blame, names the next step: "Your grown-up is taking one last look. You're all set the moment they say go." — adjust to catalog tone), and a parent-facing variant for any parent surface that shows mission state.

### REFACTOR
- None.

### EDIT
1. `apps/web-v2/lib/db/repos.ts` — `createLessonRun` (~`:1867`): after the existing brain-existence check (`:1885-1892`), add the approval check — if `brain.cloneStage !== "approved"`, return `{ ok: false, code: "brain_not_approved", message: "Brain profile awaiting parent approval before lesson generation" }`. Extend the `CreateLessonRunResult` error-code union (`:1851-1856`) with `"brain_not_approved"`. **The gate lives here** so every caller (today/start, quests, teacher assignments, creator pre-generation, any future path) inherits it. Grep all `createLessonRun` callers and confirm each maps the new code to a sane response.
2. `apps/web-v2/lib/learner/today.ts` — `pickTodaysMission`: load the brain profile alongside the learner and return a new blocker `{ ready: false, blocker: "brain_not_approved" }` when a completed baseline exists but `cloneStage !== "approved"` (keep `no_baseline` semantics for the pre-baseline case). Extend the `TodayMissionResult` blocker union. This makes the home surface honest *before* the hard gate fires.
3. `apps/web-v2/app/api/bff/learners/[learnerId]/today/start/route.ts` — map both the picker blocker and the `createLessonRun` error code to `ERRORS.PRECONDITION_FAILED` with the typed code `brain_not_approved` in the failure payload (follow the existing `errMap` shape at `:88-96`), so clients can branch on it.
4. Learner home (`apps/web-v2/app/learner/home/page.tsx` and whatever component renders the Today's Mission card — locate by the blocker handling for `no_baseline`): render the blocked state with the new i18n copy. Every state designed: the blocked card needs its own visual (not an error toast), with no dead end (link/illustration appropriate for a child; do NOT link the child to the parent approval page).
5. If Suite A creator job exists in-tree (`app/api/internal/creator/pregenerate/route.ts` and its caller): ensure a `brain_not_approved` result is skipped with a structured log line (learnerId + reason), not thrown.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report roadmap DoD, verbatim: **"A learner with `cloneStage !== "approved"` receives a typed `brain_not_approved` blocker from `/today/start`; regression test mirrors `readiness.brain-build.test.ts` cases."**

Extended verification (all must hold):
1. `corepack pnpm --filter @aivo/web-v2 test` green, including the new `lesson-gate.brain-approval.test.ts`.
2. Runtime proof (the ❓-appendix rider — this audit never ran the app): start the app (`corepack pnpm --filter @aivo/web-v2 dev`), use the mock session cookie to walk: parent completes flow → learner home shows the blocked card pre-approval → `POST /api/bff/learners/<id>/today/start` returns the typed failure (capture the JSON) → approve via `/parent/learners/<id>/brain-clone-watch` → same POST now creates a run. Capture screenshots of blocked and unblocked learner home for the Checkpoint.
3. Viewport rider: walk the parent assessment wizard at a 390×844 viewport and note any rendering defects in the Checkpoint (evidence for ❓ "mobile parent assessment rendering"; fixing layout defects found is **C-11**'s job unless trivially small).
4. Grep proof: no remaining lesson-creation path bypasses the gate — `grep -rn "createLessonRun" apps/web-v2` output reviewed and each caller's handling listed in the Checkpoint.
5. The D8 behavior change (teacher-assigned lessons blocked pre-approval) demonstrated and explicitly flagged in the Checkpoint summary.

## Tests

- **Create** `apps/web-v2/lib/db/__tests__/lesson-gate.brain-approval.test.ts`, mirroring the setup style of `apps/web-v2/lib/learner/readiness.brain-build.test.ts` (direct persistence seeding): `cloned` → `createLessonRun` returns `brain_not_approved`; `pre_clone` → blocked; `approved` → run created with `brainStateSnapshot` populated; teacher-assigned source also blocked when unapproved (D8); quest source blocked when unapproved.
- **Extend** the BFF coverage for `/today/start` (follow the existing route-test conventions found near other BFF tests): blocked → `PRECONDITION_FAILED` + code `brain_not_approved`; approved → 200 with run.
- Run the **full suite** (`pnpm test` at repo root, plus `corepack pnpm --filter @aivo/web-v2 e2e` or the locally-runnable subset, stating exactly which specs ran) so previously completed sprints stay green.

## Out of scope

- brain-svc / Python changes (C-02 covers access control; C-12 covers cross-stack gate unification).
- The approval *experience* (consent, RAI, ceremony — C-06) and corrections (C-05).
- Mobile (C-04).
- Copy changes inside the reveal (C-03).

## Depends on

- None in this track (recommended first). Cross-track: be aware of Suite A sprints 06/07 (creator) if present — see EDIT-5.

## Checkpoint

At sprint end: summarize every changed file; paste the blocked/unblocked `/today/start` JSON and the two screenshots; list each `createLessonRun` caller and its gate handling; explicitly flag the D8 teacher-assignment behavior change and the viewport-rider findings. **Pause for owner review. Do not commit unless explicitly told to.**
