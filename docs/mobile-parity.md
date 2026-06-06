# Mobile Parity Audit

> **Generated** by `scripts/web-mobile-parity-check.mjs`. Do not hand-edit —
> update `PARITY_MATRIX` in the script and run `pnpm mobile:parity:md`.

Comparison of the Expo mobile app (`apps/mobile/`) against the Next.js web
app (`apps/web-v2/`) across the five roles that ship in the unified mobile
app: **learner, parent, teacher, therapist, caregiver**. School / district /
internal admin surfaces are web-only and excluded (see `docs/NAVIGATION.md`).

Status legend: **Parity** comparable on both · **Partial** present but a
sub-feature is missing · **Missing** not yet on mobile.

## Summary

| Status | Count |
| ------ | ----- |
| Parity | 113 |
| Partial | 0 |
| Missing | 1 |
| **In-scope total** | **114** |

Full parity: **99%**. 22 web-only routes excluded.

## Surface-Type Parity

| Surface type | Web support | Mobile support | Parity |
| ------------ | ----------- | -------------- | ------ |
| `choice_grid` | full | full | Yes |
| `scratchpad` | full | full | Yes |
| `math_expression` | full | full | Yes |
| `number_line` | full | full | Yes |
| `coding_sandbox` | full | full | Yes |
| `art_canvas` | full | full | Yes |
| `voice_response` | full | full | Yes |
| `video` | full | full | Yes |
| `audio` | full | full | Yes |
| `geometry_workspace` | full | full | Yes |
| `reading_annotation` | full | full | Yes |
| `graph` | full | full | Yes |
| `drag_manipulative` | full | full | Yes |
| `multi_step_workspace` | full | full | Yes |
| `science_diagram` | full | full | Yes |
| `music_sequencer` | full | full | Yes |

## Subject Visibility Parity

Both learner subject grids consume the canonical `getDiscoverableSubjects()` registry.

| Subject | Web visible | Mobile visible | Parity |
| ------- | ----------- | -------------- | ------ |
| `reading` | Yes | Yes | Yes |
| `math` | Yes | Yes | Yes |
| `science` | Yes | Yes | Yes |
| `social` | Yes | Yes | Yes |
| `speech` | Yes | Yes | Yes |
| `executive-function` | Yes | Yes | Yes |
| `writing` | Yes | Yes | Yes |
| `life` | Yes | Yes | Yes |
| `art` | Yes | Yes | Yes |
| `social-studies` | Yes | Yes | Yes |
| `world-languages` | Yes | Yes | Yes |
| `coding` | Yes | Yes | Yes |
| `geography` | Yes | Yes | Yes |
| `music` | Yes | Yes | Yes |
| `physical-education` | Yes | Yes | Yes |
| `engineering` | Yes | Yes | Yes |

## Tutor Behavior Parity

| Capability | Mobile implemented | Missing markers |
| ---------- | ------------------ | --------------- |
| agentic tutor chat | Yes | None |
| tutor session completion | Yes | None |
| PRE-K voice input | Yes | None |
| tutor read-aloud | Yes | None |
| structured lesson launch | Yes | None |
| tutor SKU API contract | Yes | None |
| all tutor discovery | Yes | None |

## PRE-K Tutor Discovery

| Tutor | Available to EARLY / PRE-K |
| ----- | -------------------------- |
| `colors` | Yes |
| `sage` | Yes |
| `spark` | Yes |
| `chrono` | Yes |
| `pixel` | Yes |
| `echo` | Yes |
| `harmony` | Yes |
| `atlas` | Yes |
| `cadence` | Yes |
| `vigor` | Yes |
| `lingua` | Yes |
| `forge` | Yes |
| `compass` | Yes |
| `muse` | Yes |

## Auth & Shared

| Web route | Mobile screen | Status | Gap / Ticket |
| --------- | ------------- | ------ | ------------ |
| `/` | `index` | Parity | — |
| `/login` | `(auth)/login` | Parity | — |
| `/login/mfa` | `(auth)/verify-mfa` | Parity | — |
| `/signup` | `(auth)/signup` | Parity | — |
| `/forgot-password` | `(auth)/forgot-password` | Parity | — |
| `/reset-password` | `(auth)/reset-password` | Parity | — |
| `/accept-invite` | `accept-invite` | Parity | — |
| `/settings/accessibility` | `settings/accessibility` | Parity | — |
| `/messages` | `messages` | Parity | — |
| `/notifications` | `notifications` | Parity | — |

## Onboarding

| Web route | Mobile screen | Status | Gap / Ticket |
| --------- | ------------- | ------ | ------------ |
| `/onboarding` | `(onboarding)/index` | Parity | — |
| `/onboarding/welcome` | `(onboarding)/welcome` | Parity | — |
| `/onboarding/role` | `(onboarding)/role` | Parity | — |
| `/onboarding/signup` | `(auth)/signup` | Parity | — |
| `/onboarding/signin` | `(auth)/login` | Parity | — |
| `/onboarding/terms` | `(onboarding)/terms` | Parity | — |
| `/onboarding/privacy` | `(onboarding)/privacy` | Parity | — |
| `/onboarding/consent` | `(auth)/consent-sheet` | Parity | — |
| `/onboarding/recovery` | `(auth)/forgot-password` | Parity | — |
| `/onboarding/pin` | `(auth)/pin` | Parity | — |
| `/onboarding/permissions` | `(onboarding)/permissions` | Parity | — |
| `/onboarding/parent-setup` | `(parent)/onboard` | Parity | — |
| `/onboarding/parent-verify` | `(onboarding)/parent-verify` | Parity | — |
| `/onboarding/iep-upload` | `(onboarding)/iep-upload` | Parity | — |
| `/onboarding/child-approval` | `(onboarding)/child-approval` | Parity | — |
| `/onboarding/learner/new` | `(onboarding)/learner/new` | Parity | — |
| `/onboarding/error` | `(onboarding)/error` | Parity | — |

## Learner

| Web route | Mobile screen | Status | Gap / Ticket |
| --------- | ------------- | ------ | ------------ |
| `/learner/home` | `(learner)/index` | Parity | — |
| `/learner/calm` | — | **Missing** | Calm Corner activities, persistence, and learner controls are not implemented on mobile. |
| `/learner/select` | `(auth)/session-switch` | Parity | — |
| `/learner/subjects` | `(learner)/subjects/index` | Parity | — |
| `/learner/subjects/[subjectId]` | `(learner)/subjects/[subjectId]` | Parity | — |
| `/learner/baseline` | `(learner)/baseline/index` | Parity | — |
| `/learner/baseline/intro` | `(learner)/baseline/index` | Parity | — |
| `/learner/baseline/why` | `(learner)/baseline/index` | Parity | — |
| `/learner/baseline/readiness` | `(learner)/baseline/index` | Parity | — |
| `/learner/baseline/subjects` | `(learner)/baseline/index` | Parity | — |
| `/learner/baseline/[baselineId]` | `(learner)/baseline/run` | Parity | — |
| `/learner/library` | `(learner)/library` | Parity | — |
| `/learner/lesson-runs/[lessonRunId]` | `(learner)/stage/[sessionId]` | Parity | — |
| `/learner/missions` | `(learner)/missions` | Parity | — |
| `/learner/quests` | `(learner)/quests/index` | Parity | — |
| `/learner/quests/[worldId]` | `(learner)/quests/[worldSlug]/index` | Parity | — |
| `/learner/quests/[worldId]/chapters/[chapterId]` | `(learner)/quests/[worldSlug]/play/[questId]` | Parity | — |
| `/learner/progress` | `(learner)/progress` | Parity | — |
| `/learner/rewards` | `(learner)/badges` | Parity | — |
| `/learner/homework` | `(learner)/homework/index` | Parity | — |
| `/learner/homework/[sessionId]` | `(learner)/homework/[sessionId]` | Parity | — |
| `/learner/tutor` | `(learner)/tutor/[tutorSlug]` | Parity | — |
| `/learner/settings` | `(learner)/settings` | Parity | — |
| `/learner/settings/accessibility` | `(learner)/accessibility` | Parity | — |
| `/learner/settings/audio` | `(learner)/audio` | Parity | — |
| `/learner/brain-clone/[learnerId]` | `(learner)/brain` | Parity | — |

## Parent

| Web route | Mobile screen | Status | Gap / Ticket |
| --------- | ------------- | ------ | ------------ |
| `/parent/home` | `(parent)/index` | Parity | — |
| `/parent/home-v2` | `(parent)/home-v2` | Parity | — |
| `/parent/learners` | `(parent)/learners/index` | Parity | — |
| `/parent/learners/new` | `(parent)/learner-new/index` | Parity | — |
| `/parent/learners/[learnerId]` | `(parent)/learners/[learnerId]` | Parity | — |
| `/parent/learners/[learnerId]/assessment` | `(parent)/assessment/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/assessment/intro` | `(parent)/assessment/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/assessment/review` | `(parent)/assessment/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/assessment/submitted` | `(parent)/assessment/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/baseline` | `(parent)/baseline/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/baseline/pending` | `(parent)/baseline/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/baseline/summary` | `(parent)/baseline/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/brain-clone-watch` | `(parent)/brain-clone-watch/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/brain-profile` | `(parent)/brain/[childId]/index` | Parity | — |
| `/parent/learners/[learnerId]/curriculum` | `(parent)/curriculum/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/gradebook` | `(parent)/gradebook/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/homework` | `(parent)/homework/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/iep` | `(parent)/iep/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/iep/review` | `(parent)/iep-review/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/lessons` | `(parent)/lessons/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/milestones` | `(parent)/milestones/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/profile-v2` | `(parent)/profile-v2/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/progress` | `(parent)/progress/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/sensory` | `(parent)/sensory/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/settings` | `(parent)/settings-learner/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/snapshot` | `(parent)/snapshot/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/summary` | `(parent)/summary/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/team` | `(parent)/team/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/accessibility` | `(parent)/accessibility/[childId]` | Parity | — |
| `/parent/learners/[learnerId]/accessibility/audio` | `(parent)/accessibility/audio/[childId]` | Parity | — |
| `/parent/consent` | `(parent)/consent/index` | Parity | — |
| `/parent/consent/[learnerId]` | `(parent)/consent/[learnerId]` | Parity | — |
| `/parent/reports` | `(parent)/reports` | Parity | — |
| `/parent/schedule` | `(parent)/schedule/[childId]` | Parity | — |
| `/parent/privacy` | `(parent)/privacy/index` | Parity | — |
| `/parent/privacy/data-export` | `(parent)/privacy/data-export` | Parity | — |
| `/parent/privacy/delete-data` | `(parent)/privacy/delete-data` | Parity | — |
| `/parent/settings` | `(parent)/settings` | Parity | — |
| `/parent/settings/account` | `(parent)/settings-account/index` | Parity | — |
| `/parent/settings/billing` | `(parent)/billing` | Parity | — |

## Teacher

| Web route | Mobile screen | Status | Gap / Ticket |
| --------- | ------------- | ------ | ------------ |
| `/teacher/home` | `(teacher)/index` | Parity | — |
| `/teacher/learners` | `(teacher)/learners` | Parity | — |
| `/teacher/learners/[learnerId]` | `(teacher)/student/[id]/index` | Parity | — |
| `/teacher/learners/[learnerId]/curriculum` | `(teacher)/curriculum/[id]` | Parity | — |
| `/teacher/learners/[learnerId]/iep/draft` | `(teacher)/student/[id]/iep` | Parity | — |
| `/teacher/classes` | `(teacher)/classes/index` | Parity | — |
| `/teacher/classes/[classId]` | `(teacher)/classes/[classId]` | Parity | — |
| `/teacher/assignments` | `(teacher)/assignments/index` | Parity | — |
| `/teacher/assignments/new` | `(teacher)/assignments/new` | Parity | — |
| `/teacher/insights` | `(teacher)/insights` | Parity | — |
| `/teacher/lesson-plans` | `(teacher)/lesson-plan` | Parity | — |
| `/teacher/reports` | `(teacher)/analytics` | Parity | — |
| `/teacher/settings` | `(teacher)/settings` | Parity | — |

## Therapist

| Web route | Mobile screen | Status | Gap / Ticket |
| --------- | ------------- | ------ | ------------ |
| `/therapist/home` | `(therapist)/index` | Parity | — |
| `/therapist/sessions` | `(therapist)/sessions` | Parity | — |
| `/therapist/reports` | `(therapist)/reports` | Parity | — |
| `/therapist/settings` | `(therapist)/settings` | Parity | — |

## Caregiver

| Web route | Mobile screen | Status | Gap / Ticket |
| --------- | ------------- | ------ | ------------ |
| `/caregiver/home` | `(caregiver)/index` | Parity | — |
| `/caregiver/learners` | `(caregiver)/learners` | Parity | — |
| `/caregiver/observations` | `(caregiver)/child/[childId]/observation` | Parity | — |
| `/caregiver/settings` | `(caregiver)/settings` | Parity | — |
