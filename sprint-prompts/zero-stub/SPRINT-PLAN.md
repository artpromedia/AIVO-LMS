# Zero-Stub Remediation — Sprint Plan

> Prompt-authoring plan only. Do not execute any sprint until the owner explicitly says `proceed`.
> Scope is surgical: close concrete dead/stubbed learner and parent controls in web + mobile, or explicitly route decision-gated items to the owning track.

## Current-code verification summary

| ID | Re-verified current location | Current symptom / drift note | Planning impact |
|---|---|---|---|
| LW-1 | `apps/web-v2/app/learner/subjects/[subjectId]/page.tsx:188-190`; `apps/web-v2/app/learner/home/page.tsx:75-132,166-170` | Subject CTA passes `subjectId`/`skillId` as query params, but learner home only accepts `blocker` and `startMissionAction` always calls `pickTodaysMission(...)`. | Sprint 01 wires query-aware, subject-specific lesson start. |
| LW-2 | `apps/web-v2/app/learner/home/page.tsx:409-453`; `packages/ui/src/learner-dashboard/FeaturedLessonCard.tsx:137-147` | Featured lesson secondary buttons render active `<button>` controls but no `onClick`/handler is supplied. | Sprint 01 wires Read Aloud and Overview; Read Aloud defaults to wire, not remove. |
| LW-3 | `apps/web-v2/lib/db/repos.ts:2721-2730`; `apps/web-v2/lib/ai/anthropic-tutor.ts:125-145`; `apps/web-v2/lib/ai/tutor.ts:147-160` | Lesson generation still documents/uses mock/deterministic fallback paths. | Sprint 05 is decision-gated and coordinates with functional-readiness. |
| LM-1 | `apps/mobile/app/(learner)/stage/[sessionId].tsx:346-352`; `apps/mobile/src/api/stageClient.ts:24-27` | Tutor-turn continue calls `ackBeat`, but `ackBeat` is `Promise.resolve()` and persists nothing. | Sprint 03 wires beat acknowledgement to real session progress. |
| PW-1 | `apps/web-v2/app/parent/settings/page.tsx:26-57` | Privacy section is a header/description shell with no controls. | Sprint 04 wires or removes the privacy affordance; recommended wire. |
| PM-1 | `apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx:77-84,220-239` | Mobile explicitly hands approval to web. This may be intentional under Assessment-UX D1a, but conflicts with a native mobile E2E promise. | Sprint 02 is blocked pending decision; align with Assessment-UX approval contract. |
| PM-2 | `apps/mobile/app/(parent)/iep/[childId].tsx:275-294` | Camera/PDF upload buttons show `featureUnavailable` alerts. | Sprint 04 wires uploads or removes buttons; recommended wire if upload APIs exist. |
| PM-3 | `apps/mobile/app/(parent)/inbox.tsx:82-90` | Unmapped action URLs dead-end to an open-on-web alert. | Sprint 04 expands native route mapping for approved action types; unsupported actions become honest non-action copy or clean web handoff per decision. |
| PM-4 | `apps/mobile/app/(parent)/learner-new/index.tsx:34-43,100-107` | Mobile add-learner requires/collects PIN before brain approval sequence. | Cross-track dependency on Apps/RBAC onboarding Sprint 03/04 unless owner redirects here. |

## Sprint list in execution order

| # | Sprint file | Status | One-line goal | Surface | Defects closed / mapped |
|---|---|---|---|---|---|
| 01 | `sprint-01-learner-web-subject-start-and-featured-actions.md` | Ready | Make subject Start Lesson launch that specific subject/skill and make Read Aloud/Overview real controls. | learner web (`apps/web-v2`, `packages/ui`) | LW-1, LW-2 |
| 02 | `sprint-02-parent-mobile-brain-approval-decision.md` | **Blocked: Decision 2** | Either build native mobile approval parity or make web handoff the formal, clean mobile contract. | parent mobile + approval contract | PM-1 |
| 03 | `sprint-03-learner-mobile-tutor-turn-progress.md` | Ready | Persist tutor-turn acknowledgements so non-choice beats advance real per-beat progress. | learner mobile | LM-1 |
| 04 | `sprint-04-parent-settings-and-mobile-dead-controls.md` | Partially blocked: Decision 4 | Remove or wire parent privacy, IEP upload, and inbox dead-end controls; recommended wire where APIs/routes exist. | parent web + parent mobile | PW-1, PM-2, PM-3 |
| 05 | `sprint-05-lesson-generation-fallback-decision.md` | **Blocked: Decision 1** | Resolve mock/deterministic tutor fallback as either provider-backed production flow or explicit degraded/offline state. | learner web lesson generation | LW-3 |

## Coverage table

| Defect | Owner | Sprint / cross-track | Direction |
|---|---|---|---|
| LW-1 | This track | Sprint 01 | Wire subject-specific lesson start end-to-end. |
| LW-2 | This track | Sprint 01 | Wire Read Aloud and Overview; do not remove Read Aloud unless owner vetoes. |
| LW-3 | This track + functional-readiness coordination | Sprint 05, decision-gated | Recommended: no silent production fallback; fail/degrade explicitly. |
| LM-1 | This track | Sprint 03 | Wire ackBeat to persisted stage/session progress. |
| PW-1 | This track | Sprint 04 | Wire privacy controls if backing APIs exist; otherwise remove the shell/link until ready. |
| PM-1 | This track + Assessment-UX/onboarding coordination | Sprint 02, decision-gated | Recommended: native parity only after shared approval/consent contract is available; otherwise formal clean web handoff. |
| PM-2 | This track | Sprint 04 | Wire IEP camera/PDF upload to real picker/upload path or remove upload card. |
| PM-3 | This track | Sprint 04, scoped by Decision 4 | Wire approved notification action types to native routes; unsupported types get honest web handoff or no CTA. |
| PM-4 | Apps/RBAC onboarding track unless redirected | Cross-track dependency: `sprint-prompts/apps-rbac-onboarding/sprint-03-pin-after-approval-gate.md` and Sprint 04 state machine | Confirm mobile add-learner screen is updated there to stop collecting PIN until approval. |

## Cross-track dependencies

| Track | Dependency |
|---|---|
| Apps/RBAC onboarding | PM-4 is same surface as Gap 3/R3-R4. Confirm their Sprint 03/04 explicitly edits `apps/mobile/app/(parent)/learner-new/index.tsx`; if not, add a small rider to this track after owner decision. |
| Assessment-UX | PM-1 must use the approval ceremony/consent/RAI contract from Assessment-UX C-04/C-06/C-12 rather than inventing another approval model. |
| Functional-readiness / creator content | LW-3 must resolve consistently with the adaptive-tutor readiness decision: production lesson generation must not silently teach from mocks while claiming adaptive AI. |

## Decisions needed

| Decision | Gates | Recommended resolution to review |
|---|---|---|
| 1. LW-3 — mock tutor fallback | Sprint 05 | Replace silent production fallback with provider-backed flow plus explicit degraded/offline state; mocks only in tests/dev. |
| 2. PM-1 — mobile brain approval | Sprint 02 | If native mobile is part of E2E promise, build parity after shared approval contract; otherwise make web handoff intentionally productized and remove native-approval claims. |
| 3. PM-4 — PIN ordering | Cross-track PM-4 owner, possible rider here | Confirm PIN collection moves after brain approval and that Apps/RBAC owns the mobile screen change. |
| 4. PM-3 — notification actions | Sprint 04 | Declare the mobile-native action allowlist before implementation; everything else must be a clean web handoff or no CTA. |

## Execution note

Open one sprint prompt in order in a fresh implementation session. Each prompt is self-contained and ends with a checkpoint. Do not start the next sprint until reviewed.
