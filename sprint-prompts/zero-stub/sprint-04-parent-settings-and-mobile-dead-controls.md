# Sprint 04 — Parent settings + mobile dead controls

## Goal
Close PW-1, PM-2, and PM-3 by wiring or removing parent-facing dead controls: privacy settings shell, IEP Camera/PDF uploads, and inbox action dead-ends.

## Context
Affected stack: `apps/web-v2` parent settings and `apps/mobile` parent IEP/inbox. Re-verified symptoms:
- PW-1: `apps/web-v2/app/parent/settings/page.tsx:26-57` renders account/billing cards and a privacy header only; there are no privacy controls.
- PM-2: `apps/mobile/app/(parent)/iep/[childId].tsx:275-294` renders Camera and PDF buttons whose handlers only alert `featureUnavailable`.
- PM-3: `apps/mobile/app/(parent)/inbox.tsx:82-90` maps known URLs to native routes, but unmapped action URLs fall into a generic open-on-web alert.

## Work orders
### DELETE
- Delete any active privacy/upload/inbox CTA that cannot be wired to a real route/API this sprint.
- Delete `featureUnavailable` and generic dead-end alert handlers from these surfaces.

### CREATE
- For PW-1: create real privacy controls backed by existing account/privacy/consent APIs, or create a clear non-interactive informational section if no controls are intended.
- For PM-2: create camera/document picker upload path to the real IEP upload API, including progress, errors, and refreshed timeline/goals.
- For PM-3: create a native notification action allowlist and tests for each supported route.

### REFACTOR
- Centralize `mapInboxUrlToMobileRoute` behavior so unsupported URLs are intentionally classified: native route, clean web handoff, or no CTA.

### EDIT
- `apps/web-v2/app/parent/settings/page.tsx`: replace privacy shell with real controls or remove the section from the settings grid/page.
- `apps/mobile/app/(parent)/iep/[childId].tsx`: wire Camera/PDF to real pickers and upload mutation, or remove the upload card entirely.
- `apps/mobile/app/(parent)/inbox.tsx` and route-mapping helpers: expand native mappings per Decision 4 and remove dead alerts.
- i18n strings for all changed copy.

## Implementation standard
- Everything works end-to-end. No placeholders, stubs, mocks outside test files, TODOs, FIXMEs, no-op handlers (`() => {}`), "coming soon"/"feature unavailable" alerts standing in for functionality, hardcoded data in place of real API/data calls, or dead navigation. Before declaring done, grep the changed surface for `TODO|FIXME|stub|placeholder|mock|coming soon|not implemented|WIP|alert(|() => {}` and resolve every hit on a user-facing path.
- **Real-control bar:** every button/link/tab/card touched must trace handler → service/API call → real data operation → UI reflects the result. A control that can't trace that chain is either wired until it can, or removed.
- **No new dead clicks:** the fix must not introduce a control that looks active but isn't.

## Definition of done
- Privacy section has real controls that persist and reload, or no longer appears as an active/settings affordance.
- IEP Camera/PDF either upload real files into the learner IEP flow with visible progress/result, or are removed.
- Inbox action buttons route natively for the approved allowlist; unsupported actions do not masquerade as native dead clicks.
- Run web settings and mobile IEP/inbox flows click-by-click; verify persisted settings/uploaded file/routed notification result.
- Re-run grep sweep and interactive traces on all changed parent surfaces.

## Tests
- Add/update web tests for privacy controls or section removal.
- Add/update mobile tests for IEP upload and inbox routing.
- Run relevant web/mobile tests plus full suite.

## Out of scope
- Do not build native brain approval (Sprint 02).
- Do not change PIN sequencing (PM-4 cross-track).
- Do not add unsupported notification action types without owner decision.

## Depends on
- Decision 4 for PM-3 native notification action allowlist.

## Checkpoint
Summarize wire-vs-remove choices per item, tests, and click evidence. Pause for owner review. No commits unless explicitly instructed.
