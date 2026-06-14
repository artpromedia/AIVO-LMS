# Sprint 01 — Learner web subject start + featured actions

## Goal
Close LW-1 and LW-2 so learner web controls are real: subject detail Start Lesson launches the requested subject/skill, and featured lesson Read Aloud + Overview controls perform real, observable actions.

## Context
Affected stack: `apps/web-v2` learner routes and `packages/ui` dashboard components. Re-verified symptoms:
- LW-1: `apps/web-v2/app/learner/subjects/[subjectId]/page.tsx:188-190` links to `/learner/home?subjectId=...&skillId=...`, but `apps/web-v2/app/learner/home/page.tsx:166-170` only accepts `blocker`, and `startMissionAction` at `apps/web-v2/app/learner/home/page.tsx:75-132` always calls `pickTodaysMission` instead of honoring the requested subject/skill.
- LW-2: `apps/web-v2/app/learner/home/page.tsx:409-453` renders Read Aloud and Overview secondary buttons; `packages/ui/src/learner-dashboard/FeaturedLessonCard.tsx:137-147` makes them active buttons, but no handler is passed.

## Work orders
### DELETE
- Delete any dead secondary action button if it cannot be wired in this sprint. Do not leave it visible with no handler. Read Aloud is accessibility-critical; default to wiring it.

### CREATE
- Create/extend tests for subject-specific lesson start: query params are parsed, hidden form fields carry `subjectId`/`skillId`, and `createLessonRun` receives those exact IDs.
- Create a focused interaction test for Read Aloud and Overview on the featured lesson card.

### REFACTOR
- If needed, extract mission-selection logic so generic today mission and subject-requested mission share consent/rate-limit/brain-gate behavior without duplicating authorization checks.

### EDIT
- `apps/web-v2/app/learner/home/page.tsx`: accept `subjectId` and `skillId` in `searchParams`; validate they belong to the active learner/tenant; pass them through the Start form; use them in `createLessonRun` instead of discarding them.
- `apps/web-v2/app/learner/subjects/[subjectId]/page.tsx`: keep the CTA but ensure the destination and labels make the selected subject/skill explicit.
- `packages/ui/src/learner-dashboard/FeaturedLessonCard.tsx`: require or clearly model secondary action handlers so active controls cannot be rendered accidentally without behavior.
- Implement Read Aloud as a real text-to-speech/accessibility control over the featured lesson title/body/summary, with visible state and stop/pause behavior where browser APIs allow. If Web Speech is unavailable, render an honest disabled/unavailable state rather than an active dead button.
- Implement Overview as a real navigation or disclosure to the selected lesson/subject overview, backed by real data already present on the page.

## Implementation standard
- Everything works end-to-end. No placeholders, stubs, mocks outside test files, TODOs, FIXMEs, no-op handlers (`() => {}`), "coming soon"/"feature unavailable" alerts standing in for functionality, hardcoded data in place of real API/data calls, or dead navigation. Before declaring done, grep the changed surface for `TODO|FIXME|stub|placeholder|mock|coming soon|not implemented|WIP|alert(|() => {}` and resolve every hit on a user-facing path.
- **Real-control bar:** every button/link/tab/card touched must trace handler → service/API call → real data operation → UI reflects the result. A control that can't trace that chain is either wired until it can, or removed.
- **No new dead clicks:** the fix must not introduce a control that looks active but isn't.

## Definition of done
- Subject detail Start Lesson for a known subject/skill creates or resumes a lesson run for that exact `subjectId`/`skillId`, not the generic today mission.
- Invalid or unauthorized query IDs are rejected calmly and do not create runs.
- Read Aloud starts/stops real speech or renders a non-clickable unavailable state when unsupported.
- Overview opens real overview content or navigates to a real subject/lesson overview.
- Run the web app and click: subject detail → Start Lesson → verify lesson run subject/skill; learner home → Read Aloud; learner home → Overview.
- Re-run the grep sweep and an interactive-element trace on learner home + subject detail; confirm no remaining dead clicks in the changed surface.

## Tests
- Add/update unit/component tests for query parsing, server action input, and secondary actions.
- Add/update Playwright coverage for the click path if this repo already has learner e2e patterns.
- Run the relevant package tests plus full repo suite.

## Out of scope
- Do not redesign learner dashboard visuals.
- Do not change tutor provider fallback policy (LW-3; Sprint 05).
- Do not touch mobile stage progress (Sprint 03).

## Depends on
None.

## Checkpoint
Summarize changes, tests, and live-click evidence. Pause for owner review. No commits unless explicitly instructed.
