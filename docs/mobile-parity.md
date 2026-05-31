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

| Status             | Count   |
| ------------------ | ------- |
| Parity             | 100     |
| Partial            | 13      |
| Missing            | 0       |
| **In-scope total** | **113** |

Full parity: **88%**. 90 web-only routes excluded.

## Auth & Shared

| Web route                 | Mobile screen            | Status | Gap / Ticket |
| ------------------------- | ------------------------ | ------ | ------------ |
| `/`                       | `index`                  | Parity | —            |
| `/login`                  | `(auth)/login`           | Parity | —            |
| `/login/mfa`              | `(auth)/verify-mfa`      | Parity | —            |
| `/signup`                 | `(auth)/signup`          | Parity | —            |
| `/forgot-password`        | `(auth)/forgot-password` | Parity | —            |
| `/reset-password`         | `(auth)/reset-password`  | Parity | —            |
| `/accept-invite`          | `accept-invite`          | Parity | —            |
| `/settings/accessibility` | `settings/accessibility` | Parity | —            |

## Onboarding

| Web route                    | Mobile screen                 | Status      | Gap / Ticket                                                                        |
| ---------------------------- | ----------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `/onboarding`                | `(onboarding)/index`          | Parity      | —                                                                                   |
| `/onboarding/welcome`        | `(onboarding)/welcome`        | Parity      | —                                                                                   |
| `/onboarding/role`           | `(onboarding)/role`           | Parity      | —                                                                                   |
| `/onboarding/signup`         | `(auth)/signup`               | **Partial** | MOB-ONB-004: invite-code + footer terms parity with web signup.                     |
| `/onboarding/signin`         | `(auth)/login`                | Parity      | —                                                                                   |
| `/onboarding/terms`          | `(onboarding)/terms`          | Parity      | —                                                                                   |
| `/onboarding/privacy`        | `(onboarding)/privacy`        | Parity      | —                                                                                   |
| `/onboarding/consent`        | `(auth)/consent-sheet`        | **Partial** | MOB-ONB-007: full consent checkboxes (data, analytics, marketing) vs current sheet. |
| `/onboarding/recovery`       | `(auth)/forgot-password`      | Parity      | —                                                                                   |
| `/onboarding/pin`            | `(auth)/pin`                  | Parity      | —                                                                                   |
| `/onboarding/permissions`    | `(onboarding)/permissions`    | Parity      | —                                                                                   |
| `/onboarding/parent-setup`   | `(parent)/onboard`            | **Partial** | MOB-ONB-009: learner creation + assessment-intro parity inside onboarding.          |
| `/onboarding/parent-verify`  | `(onboarding)/parent-verify`  | Parity      | —                                                                                   |
| `/onboarding/iep-upload`     | `(onboarding)/iep-upload`     | Parity      | —                                                                                   |
| `/onboarding/child-approval` | `(onboarding)/child-approval` | Parity      | —                                                                                   |
| `/onboarding/learner/new`    | `(onboarding)/learner/new`    | Parity      | —                                                                                   |
| `/onboarding/error`          | `(onboarding)/error`          | Parity      | —                                                                                   |

## Learner

| Web route                                        | Mobile screen                                 | Status      | Gap / Ticket                                                                                           |
| ------------------------------------------------ | --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `/learner/home`                                  | `(learner)/index`                             | Parity      | —                                                                                                      |
| `/learner/select`                                | `(auth)/session-switch`                       | **Partial** | MOB-LRN-001: multi-learner picker / active-learner selection on the learner surface.                   |
| `/learner/subjects`                              | `(learner)/subjects/index`                    | Parity      | —                                                                                                      |
| `/learner/subjects/[subjectId]`                  | `(learner)/subjects/[subjectId]`              | Parity      | —                                                                                                      |
| `/learner/baseline`                              | `(learner)/baseline/index`                    | Parity      | —                                                                                                      |
| `/learner/baseline/intro`                        | `(learner)/baseline/index`                    | Parity      | —                                                                                                      |
| `/learner/baseline/why`                          | `(learner)/baseline/index`                    | Parity      | —                                                                                                      |
| `/learner/baseline/readiness`                    | `(learner)/baseline/index`                    | Parity      | —                                                                                                      |
| `/learner/baseline/subjects`                     | `(learner)/baseline/index`                    | Parity      | —                                                                                                      |
| `/learner/baseline/[baselineId]`                 | `(learner)/baseline/run`                      | Parity      | —                                                                                                      |
| `/learner/library`                               | `(learner)/library`                           | Parity      | —                                                                                                      |
| `/learner/lesson-runs/[lessonRunId]`             | `(learner)/stage/[sessionId]`                 | **Partial** | MOB-LRN-007: lesson-run HOST states (generating/failed/ready) + lessons list around the stage runtime. |
| `/learner/missions`                              | `(learner)/missions`                          | Parity      | —                                                                                                      |
| `/learner/quests`                                | `(learner)/quests/index`                      | Parity      | —                                                                                                      |
| `/learner/quests/[worldId]`                      | `(learner)/quests/[worldSlug]/index`          | Parity      | —                                                                                                      |
| `/learner/quests/[worldId]/chapters/[chapterId]` | `(learner)/quests/[worldSlug]/play/[questId]` | **Partial** | MOB-LRN-009: chapter-level quest navigation parity.                                                    |
| `/learner/progress`                              | `(learner)/progress`                          | Parity      | —                                                                                                      |
| `/learner/rewards`                               | `(learner)/badges`                            | **Partial** | MOB-LRN-011: quest-world/sticker-book rewards parity (mobile splits across badges/shop).               |
| `/learner/notifications`                         | `(learner)/notifications`                     | Parity      | —                                                                                                      |
| `/learner/homework`                              | `(learner)/homework/index`                    | Parity      | —                                                                                                      |
| `/learner/homework/[sessionId]`                  | `(learner)/homework/[sessionId]`              | Parity      | —                                                                                                      |
| `/learner/tutor`                                 | `(learner)/tutor/[tutorSlug]`                 | Parity      | —                                                                                                      |
| `/learner/settings`                              | `(learner)/settings`                          | Parity      | —                                                                                                      |
| `/learner/settings/accessibility`                | `(learner)/accessibility`                     | Parity      | —                                                                                                      |
| `/learner/settings/audio`                        | `(learner)/audio`                             | Parity      | —                                                                                                      |
| `/learner/brain-clone/[learnerId]`               | `(learner)/brain`                             | **Partial** | MOB-LRN-015: learner brain-clone view parity (mobile brain screen lacks clone build/XAI annotations).  |

## Parent

| Web route                                           | Mobile screen                            | Status      | Gap / Ticket                                                                                                                         |
| --------------------------------------------------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/parent/home`                                      | `(parent)/index`                         | Parity      | —                                                                                                                                    |
| `/parent/home-v2`                                   | `(parent)/home-v2`                       | Parity      | —                                                                                                                                    |
| `/parent/learners`                                  | `(parent)/learners/index`                | Parity      | —                                                                                                                                    |
| `/parent/learners/new`                              | `(parent)/learner-new/index`             | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]`                      | `(parent)/learners/[learnerId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/assessment`           | `(parent)/assessment/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/assessment/intro`     | `(parent)/assessment/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/assessment/review`    | `(parent)/assessment/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/assessment/submitted` | `(parent)/assessment/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/baseline`             | `(parent)/baseline/[childId]`            | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/baseline/pending`     | `(parent)/baseline/[childId]`            | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/baseline/summary`     | `(parent)/baseline/[childId]`            | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/brain-clone-watch`    | `(parent)/brain-clone-watch/[childId]`   | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/brain-profile`        | `(parent)/brain/[childId]/index`         | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/curriculum`           | `(parent)/curriculum/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/gradebook`            | `(parent)/gradebook/[childId]`           | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/homework`             | `(parent)/homework/[childId]`            | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/iep`                  | `(parent)/iep/[childId]`                 | **Partial** | MOB-PAR-010: IEP review sub-flow parity.                                                                                             |
| `/parent/learners/[learnerId]/iep/review`           | `(parent)/iep-review/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/lessons`              | `(parent)/lessons/[childId]`             | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/milestones`           | `(parent)/milestones/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/profile-v2`           | `(parent)/profile-v2/[childId]`          | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/progress`             | `(parent)/progress/[childId]`            | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/sensory`              | `(parent)/sensory/[childId]`             | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/settings`             | `(parent)/settings-learner/[childId]`    | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/snapshot`             | `(parent)/snapshot/[childId]`            | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/summary`              | `(parent)/summary/[childId]`             | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/team`                 | `(parent)/team/[childId]`                | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/accessibility`        | `(parent)/accessibility/[childId]`       | Parity      | —                                                                                                                                    |
| `/parent/learners/[learnerId]/accessibility/audio`  | `(parent)/accessibility/audio/[childId]` | Parity      | —                                                                                                                                    |
| `/parent/consent`                                   | `(parent)/consent/index`                 | Parity      | —                                                                                                                                    |
| `/parent/consent/[learnerId]`                       | `(parent)/consent/[learnerId]`           | Parity      | —                                                                                                                                    |
| `/parent/notifications`                             | `(parent)/inbox`                         | **Partial** | MOB-PAR-019: notifications parity (read state, live stream) vs current inbox.                                                        |
| `/parent/reports`                                   | `(parent)/reports`                       | **Partial** | MOB-PAR-020: lesson-count + recap metrics pending a lesson-runs REST endpoint (mobile shows per-learner mastery + subjects tracked). |
| `/parent/schedule`                                  | `(parent)/schedule/[childId]`            | Parity      | —                                                                                                                                    |
| `/parent/privacy`                                   | `(parent)/privacy/index`                 | Parity      | —                                                                                                                                    |
| `/parent/privacy/data-export`                       | `(parent)/privacy/data-export`           | Parity      | —                                                                                                                                    |
| `/parent/privacy/delete-data`                       | `(parent)/privacy/delete-data`           | Parity      | —                                                                                                                                    |
| `/parent/settings`                                  | `(parent)/settings`                      | Parity      | —                                                                                                                                    |
| `/parent/settings/account`                          | `(parent)/settings-account/index`        | Parity      | —                                                                                                                                    |
| `/parent/settings/billing`                          | `(parent)/billing`                       | Parity      | —                                                                                                                                    |

## Teacher

| Web route                                  | Mobile screen                  | Status      | Gap / Ticket                                                          |
| ------------------------------------------ | ------------------------------ | ----------- | --------------------------------------------------------------------- |
| `/teacher/home`                            | `(teacher)/index`              | Parity      | —                                                                     |
| `/teacher/learners`                        | `(teacher)/learners`           | Parity      | —                                                                     |
| `/teacher/learners/[learnerId]`            | `(teacher)/student/[id]/index` | Parity      | —                                                                     |
| `/teacher/learners/[learnerId]/curriculum` | `(teacher)/curriculum/[id]`    | Parity      | —                                                                     |
| `/teacher/learners/[learnerId]/iep/draft`  | `(teacher)/student/[id]/iep`   | **Partial** | MOB-TCH-003: AI SMART-goal IEP draft generation parity.               |
| `/teacher/classes`                         | `(teacher)/classes/index`      | Parity      | —                                                                     |
| `/teacher/classes/[classId]`               | `(teacher)/classes/[classId]`  | Parity      | —                                                                     |
| `/teacher/assignments`                     | `(teacher)/assignments/index`  | Parity      | —                                                                     |
| `/teacher/assignments/new`                 | `(teacher)/assignments/new`    | Parity      | —                                                                     |
| `/teacher/insights`                        | `(teacher)/insights`           | Parity      | —                                                                     |
| `/teacher/lesson-plans`                    | `(teacher)/lesson-plan`        | **Partial** | MOB-TCH-009: lesson-plan LIBRARY/list (mobile is single-plan editor). |
| `/teacher/reports`                         | `(teacher)/analytics`          | Parity      | —                                                                     |
| `/teacher/settings`                        | `(teacher)/settings`           | Parity      | —                                                                     |

## Therapist

| Web route             | Mobile screen          | Status | Gap / Ticket |
| --------------------- | ---------------------- | ------ | ------------ |
| `/therapist/home`     | `(therapist)/index`    | Parity | —            |
| `/therapist/sessions` | `(therapist)/sessions` | Parity | —            |
| `/therapist/reports`  | `(therapist)/reports`  | Parity | —            |
| `/therapist/settings` | `(therapist)/settings` | Parity | —            |

## Caregiver

| Web route                 | Mobile screen                             | Status | Gap / Ticket |
| ------------------------- | ----------------------------------------- | ------ | ------------ |
| `/caregiver/home`         | `(caregiver)/index`                       | Parity | —            |
| `/caregiver/learners`     | `(caregiver)/learners`                    | Parity | —            |
| `/caregiver/observations` | `(caregiver)/child/[childId]/observation` | Parity | —            |
| `/caregiver/settings`     | `(caregiver)/settings`                    | Parity | —            |
