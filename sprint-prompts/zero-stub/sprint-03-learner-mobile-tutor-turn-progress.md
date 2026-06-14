# Sprint 03 — Learner mobile tutor-turn progress

## Goal
Close LM-1 so tutor-turn acknowledgements persist per-beat progress instead of resolving a no-op promise.

## Context
Affected stack: `apps/mobile` learner stage runtime and session/stage API. Re-verified symptom: `apps/mobile/app/(learner)/stage/[sessionId].tsx:346-352` awaits `stageClient.ackBeat(beat)`, while `apps/mobile/src/api/stageClient.ts:24-27` returns `Promise.resolve()` and ignores the beat.

## Work orders
### DELETE
- Delete the no-op `ackBeat(_beat) { return Promise.resolve(); }` implementation.

### CREATE
- Add a persisted acknowledgement method to the mobile session client or stage client using the existing session progress endpoint/contract.
- Add tests that tutor-turn beats call the persistence client and update local/UI progress only after success.

### REFACTOR
- Align choice-beat and tutor-turn progress paths so both record `sessionId`, `learnerId`, beat identity, timestamp/status, and any required correctness/progress metadata.

### EDIT
- `apps/mobile/src/api/stageClient.ts`: make `ackBeat` accept enough context (`sessionId`, `learnerId`, beat) and persist through the real API.
- `apps/mobile/app/(learner)/stage/[sessionId].tsx`: pass context, handle loading/error states, and avoid advancing silently if persistence fails.
- Any types under `apps/mobile/src/types/stage*`: add acknowledgement payload types only if missing.

## Implementation standard
- Everything works end-to-end. No placeholders, stubs, mocks outside test files, TODOs, FIXMEs, no-op handlers (`() => {}`), "coming soon"/"feature unavailable" alerts standing in for functionality, hardcoded data in place of real API/data calls, or dead navigation. Before declaring done, grep the changed surface for `TODO|FIXME|stub|placeholder|mock|coming soon|not implemented|WIP|alert(|() => {}` and resolve every hit on a user-facing path.
- **Real-control bar:** every button/link/tab/card touched must trace handler → service/API call → real data operation → UI reflects the result. A control that can't trace that chain is either wired until it can, or removed.
- **No new dead clicks:** the fix must not introduce a control that looks active but isn't.

## Definition of done
- Continuing a tutor-turn beat sends a real persisted acknowledgement.
- Reloading/resuming the session reflects that the tutor-turn beat was completed.
- API failure does not falsely advance progress; the learner sees a retryable state.
- Run mobile learner stage and click through a tutor-turn; inspect network/log/state and resumed session.
- Re-run grep sweep and interactive trace on stage runtime.

## Tests
- Add/update mobile unit tests for `stageClient.ackBeat` and stage runtime continue behavior.
- Add contract/integration coverage for the server endpoint if missing.
- Run mobile tests plus full suite.

## Out of scope
- Do not alter lesson generation or learner web controls.
- Do not redesign stage UI.

## Depends on
Sprint 01 is not a code dependency but should lead because LW-1 is a blocker.

## Checkpoint
Summarize changes, tests, and live/resume evidence. Pause for owner review. No commits unless explicitly instructed.
