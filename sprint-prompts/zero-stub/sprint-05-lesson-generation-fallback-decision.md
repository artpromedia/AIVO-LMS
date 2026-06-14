# Sprint 05 — Lesson generation fallback decision

## Goal
Close LW-3 by resolving whether lesson generation may use mock/deterministic fallback in user-facing production flows, consistently with the functional-readiness/adaptive-tutor track.

## Context
Affected stack: `apps/web-v2` lesson generation. Re-verified symptom:
- `apps/web-v2/lib/db/repos.ts:2721-2730` describes synchronous plan generation via mock provider/default `getTutorProvider()`.
- `apps/web-v2/lib/ai/anthropic-tutor.ts:125-145` resolves real Anthropic provider when configured but otherwise can reach mock behavior.
- `apps/web-v2/lib/ai/tutor.ts:147-160` uses deterministic fallback after provider retries, logging that the learner always gets a usable lesson.
This is a product decision because zero-stub can be satisfied either by removing silent mocks from production or by making degraded/offline mode explicit and honest.

## Work orders
### DELETE
- Delete silent production fallback to `MockTutorProvider`/deterministic plans if Decision 1 chooses real provider-backed flow.
- Delete any copy/telemetry that claims adaptive AI when the generated plan is deterministic/degraded.

### CREATE
- Real-provider path: create startup/runtime hard failures or learner-facing retry/degraded UI when no provider is available, with mocks limited to test/dev.
- Explicit-degraded path: create a clearly labeled offline/degraded state and telemetry that records non-adaptive lesson generation.
- Add tests for production env behavior, missing key behavior, provider retry exhaustion, and UI result.

### REFACTOR
- Separate dev/test mock provider resolution from production provider resolution.
- Ensure `createLessonRun` returns typed errors/status that UI can render honestly.

### EDIT
- `apps/web-v2/lib/ai/anthropic-tutor.ts`: enforce chosen provider policy by environment.
- `apps/web-v2/lib/ai/tutor.ts`: replace silent deterministic fallback with chosen behavior.
- `apps/web-v2/lib/db/repos.ts`: update comments/contracts and return status/error handling.
- Learner lesson-start UI: render retry/degraded state honestly when provider is unavailable or exhausted.

## Implementation standard
- Everything works end-to-end. No placeholders, stubs, mocks outside test files, TODOs, FIXMEs, no-op handlers (`() => {}`), "coming soon"/"feature unavailable" alerts standing in for functionality, hardcoded data in place of real API/data calls, or dead navigation. Before declaring done, grep the changed surface for `TODO|FIXME|stub|placeholder|mock|coming soon|not implemented|WIP|alert(|() => {}` and resolve every hit on a user-facing path.
- **Real-control bar:** every button/link/tab/card touched must trace handler → service/API call → real data operation → UI reflects the result. A control that can't trace that chain is either wired until it can, or removed.
- **No new dead clicks:** the fix must not introduce a control that looks active but isn't.

## Definition of done
- Production lesson generation no longer silently falls back to mock/deterministic adaptive-looking content, or it clearly displays and records degraded/offline mode.
- Dev/test can still use mocks through explicit test/dev configuration.
- Provider failure path is observable in UI and telemetry.
- Run learner lesson start with real provider config and missing/broken provider config; verify exact behavior.
- Re-run grep sweep and trace changed generation surfaces.

## Tests
- Add/update unit tests for provider resolution and retry exhaustion.
- Add/update learner start tests for typed generation status.
- Run relevant web tests plus full suite.

## Out of scope
- Do not change subject-specific start behavior (Sprint 01).
- Do not redesign lesson content or curriculum selection.

## Depends on
- Decision 1: real-provider-only vs explicit degraded/offline state.
- Functional-readiness/adaptive tutor track decision.

## Checkpoint
Summarize selected policy, changes, tests, and runtime evidence. Pause for owner review. No commits unless explicitly instructed.
