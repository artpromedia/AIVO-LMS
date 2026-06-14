# Sprint 02 — Parent mobile brain approval decision

## Goal
Close PM-1 according to the product decision: either native mobile brain approval is real end-to-end, or the mobile app formally presents approval as a clean web handoff with no native-approval promise.

## Context
Affected stack: `apps/mobile` parent brain-watch route plus shared approval contract in web/services. Re-verified symptom: `apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx:77-84` states approval happens on web, and `:220-239` renders `WebReviewHandoff` instead of native approve/amend controls. This overlaps Assessment-UX approval ceremony and one-gate work; do not invent a second approval model.

## Work orders
### DELETE
- If the decision is web handoff: delete any copy, route metadata, tests, or docs claiming native mobile approval parity.
- If the decision is native parity: delete the web-only handoff as the only unapproved-state action.

### CREATE
- Native parity path: create mobile UI for consent, Responsible-AI acknowledgement, approve/amend/decline, and success/error states using the shared approval API/contract.
- Web handoff path: create tests proving the handoff opens/copies the exact web review URL and that no native approve button is rendered.

### REFACTOR
- Reuse the Assessment-UX C-06/C-12 approval/consent contract and any generated API client; do not hand-roll incompatible payloads.

### EDIT
- `apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx`: implement the chosen path end-to-end.
- Mobile API client/hooks: add calls only if native parity is chosen.
- i18n strings: update copy to reflect the chosen product contract.

## Implementation standard
- Everything works end-to-end. No placeholders, stubs, mocks outside test files, TODOs, FIXMEs, no-op handlers (`() => {}`), "coming soon"/"feature unavailable" alerts standing in for functionality, hardcoded data in place of real API/data calls, or dead navigation. Before declaring done, grep the changed surface for `TODO|FIXME|stub|placeholder|mock|coming soon|not implemented|WIP|alert(|() => {}` and resolve every hit on a user-facing path.
- **Real-control bar:** every button/link/tab/card touched must trace handler → service/API call → real data operation → UI reflects the result. A control that can't trace that chain is either wired until it can, or removed.
- **No new dead clicks:** the fix must not introduce a control that looks active but isn't.

## Definition of done
- If native parity: a parent can approve/amend/decline in mobile; the server records the approval/consent/RAI data; reloading mobile and web shows the approved state.
- If web handoff: mobile presents an intentional web-review handoff, not a dead or second-class approve button; open/copy failure states are clear and actionable.
- Run mobile app and click through child brain watch from loading → unapproved state → chosen approval/handoff path → observable result.
- Re-run the grep sweep and interactive trace on this screen.

## Tests
- Add/update React Native tests for chosen state.
- Add API/integration tests for approval mutation if native parity is chosen.
- Run mobile test suite and relevant approval-contract service/web tests.

## Out of scope
- Do not redesign the full brain watch timeline.
- Do not change PIN ordering (PM-4; Apps/RBAC onboarding).

## Depends on
- Decision 2: native mobile approval parity vs formal web handoff.
- Assessment-UX approval ceremony / one-gate contract.

## Checkpoint
Summarize chosen decision, changes, tests, and click evidence. Pause for owner review. No commits unless explicitly instructed.
