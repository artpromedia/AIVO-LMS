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
| Parity             | 38      |
| Partial            | 17      |
| Missing            | 58      |
| **In-scope total** | **113** |

Full parity: **34%**. 90 web-only routes excluded.

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

| Web route                    | Mobile screen            | Status      | Gap / Ticket                                                                        |
| ---------------------------- | ------------------------ | ----------- | ----------------------------------------------------------------------------------- |
| `/onboarding`                | —                        | **Missing** | MOB-ONB-001: onboarding entry/router screen.                                        |
| `/onboarding/welcome`        | —                        | **Missing** | MOB-ONB-002: brand welcome + sign-in/up entry.                                      |
| `/onboarding/role`           | —                        | **Missing** | MOB-ONB-003: role selector (parent/teacher).                                        |
| `/onboarding/signup`         | `(auth)/signup`          | **Partial** | MOB-ONB-004: invite-code + footer terms parity with web signup.                     |
| `/onboarding/signin`         | `(auth)/login`           | Parity      | —                                                                                   |
| `/onboarding/terms`          | —                        | **Missing** | MOB-ONB-005: terms acceptance screen.                                               |
| `/onboarding/privacy`        | —                        | **Missing** | MOB-ONB-006: privacy policy + CCPA/GDPR summary screen.                             |
| `/onboarding/consent`        | `(auth)/consent-sheet`   | **Partial** | MOB-ONB-007: full consent checkboxes (data, analytics, marketing) vs current sheet. |
| `/onboarding/recovery`       | `(auth)/forgot-password` | Parity      | —                                                                                   |
| `/onboarding/pin`            | `(auth)/pin`             | Parity      | —                                                                                   |
| `/onboarding/permissions`    | —                        | **Missing** | MOB-ONB-008: device camera/mic/notification permission priming.                     |
| `/onboarding/parent-setup`   | `(parent)/onboard`       | **Partial** | MOB-ONB-009: learner creation + assessment-intro parity inside onboarding.          |
| `/onboarding/parent-verify`  | —                        | **Missing** | MOB-ONB-010: email/SMS verification step.                                           |
| `/onboarding/iep-upload`     | —                        | **Missing** | MOB-ONB-011: IEP PDF upload + extraction (expo-document-picker).                    |
| `/onboarding/child-approval` | —                        | **Missing** | MOB-ONB-012: parent approves child profile before activation.                       |
| `/onboarding/learner/new`    | —                        | **Missing** | MOB-ONB-013: learner self-signup form.                                              |
| `/onboarding/error`          | —                        | **Missing** | MOB-ONB-014: onboarding error/recovery fallback screen.                             |

## Learner

| Web route                                        | Mobile screen                                 | Status      | Gap / Ticket                                                                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/learner/home`                                  | `(learner)/index`                             | Parity      | —                                                                                                                                                                            |
| `/learner/select`                                | `(auth)/session-switch`                       | **Partial** | MOB-LRN-001: multi-learner picker / active-learner selection on the learner surface.                                                                                         |
| `/learner/subjects`                              | `(learner)/subjects/index`                    | Parity      | —                                                                                                                                                                            |
| `/learner/subjects/[subjectId]`                  | `(learner)/subjects/[subjectId]`              | **Partial** | MOB-LRN-003: per-skill mastery grid + recommended skill path pending a skills REST endpoint (mobile shows domain mastery, tutors, supports).                                 |
| `/learner/baseline`                              | —                                             | **Missing** | MOB-LRN-004: baseline hub.                                                                                                                                                   |
| `/learner/baseline/intro`                        | —                                             | **Missing** | MOB-LRN-004: baseline intro (question count, subjects, time).                                                                                                                |
| `/learner/baseline/why`                          | —                                             | **Missing** | MOB-LRN-004: baseline 'why' reassurance screen.                                                                                                                              |
| `/learner/baseline/readiness`                    | —                                             | **Missing** | MOB-LRN-004: 4-check readiness pre-flight.                                                                                                                                   |
| `/learner/baseline/subjects`                     | —                                             | **Missing** | MOB-LRN-004: baseline subject multi-select.                                                                                                                                  |
| `/learner/baseline/[baselineId]`                 | —                                             | **Missing** | MOB-LRN-005: adaptive baseline RUNNER (IRT/streaming, breaks, supports, completion hero).                                                                                    |
| `/learner/library`                               | —                                             | **Missing** | MOB-LRN-006: completed-lessons replay library.                                                                                                                               |
| `/learner/lesson-runs/[lessonRunId]`             | `(learner)/stage/[sessionId]`                 | **Partial** | MOB-LRN-007: lesson-run HOST states (generating/failed/ready) + lessons list around the stage runtime.                                                                       |
| `/learner/missions`                              | —                                             | **Missing** | MOB-LRN-008: assignments + in-progress lessons ('missions') screen.                                                                                                          |
| `/learner/quests`                                | `(learner)/quests/index`                      | Parity      | —                                                                                                                                                                            |
| `/learner/quests/[worldId]`                      | `(learner)/quests/[worldSlug]/index`          | Parity      | —                                                                                                                                                                            |
| `/learner/quests/[worldId]/chapters/[chapterId]` | `(learner)/quests/[worldSlug]/play/[questId]` | **Partial** | MOB-LRN-009: chapter-level quest navigation parity.                                                                                                                          |
| `/learner/progress`                              | `(learner)/progress`                          | **Partial** | MOB-LRN-010: lessons-by-day trend + recent-activity list pending a lesson-runs REST endpoint (mobile shows overall/per-subject mastery, heatstrip, comparison dots, streak). |
| `/learner/rewards`                               | `(learner)/badges`                            | **Partial** | MOB-LRN-011: quest-world/sticker-book rewards parity (mobile splits across badges/shop).                                                                                     |
| `/learner/notifications`                         | —                                             | **Missing** | MOB-LRN-012: learner notifications (SSE + polling).                                                                                                                          |
| `/learner/homework`                              | `(learner)/homework/index`                    | Parity      | —                                                                                                                                                                            |
| `/learner/homework/[sessionId]`                  | `(learner)/homework/[sessionId]`              | Parity      | —                                                                                                                                                                            |
| `/learner/tutor`                                 | `(learner)/tutor/[tutorSlug]`                 | Parity      | —                                                                                                                                                                            |
| `/learner/settings`                              | `(learner)/settings`                          | Parity      | —                                                                                                                                                                            |
| `/learner/settings/accessibility`                | `(learner)/accessibility`                     | Parity      | —                                                                                                                                                                            |
| `/learner/settings/audio`                        | `(learner)/audio`                             | Parity      | —                                                                                                                                                                            |
| `/learner/brain-clone/[learnerId]`               | `(learner)/brain`                             | **Partial** | MOB-LRN-015: learner brain-clone view parity (mobile brain screen lacks clone build/XAI annotations).                                                                        |

## Parent

| Web route                                           | Mobile screen                    | Status      | Gap / Ticket                                                                                  |
| --------------------------------------------------- | -------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `/parent/home`                                      | `(parent)/index`                 | Parity      | —                                                                                             |
| `/parent/home-v2`                                   | `(parent)/home-v2`               | Parity      | —                                                                                             |
| `/parent/learners`                                  | —                                | **Missing** | MOB-PAR-001: parent learners LIST area (mobile only shows children inline on home).           |
| `/parent/learners/new`                              | —                                | **Missing** | MOB-PAR-002: add-learner form (district lookup, AI strength suggestions).                     |
| `/parent/learners/[learnerId]`                      | —                                | **Missing** | MOB-PAR-003: learner profile hub (quick-access + exploration grid + profile basics).          |
| `/parent/learners/[learnerId]/assessment`           | —                                | **Missing** | MOB-PAR-004: parent assessment wizard (17+ steps, autosave, AI suggestions).                  |
| `/parent/learners/[learnerId]/assessment/intro`     | —                                | **Missing** | MOB-PAR-004: assessment intro.                                                                |
| `/parent/learners/[learnerId]/assessment/review`    | —                                | **Missing** | MOB-PAR-004: assessment review.                                                               |
| `/parent/learners/[learnerId]/assessment/submitted` | —                                | **Missing** | MOB-PAR-004: assessment submitted confirmation.                                               |
| `/parent/learners/[learnerId]/baseline`             | —                                | **Missing** | MOB-PAR-005: parent baseline status + start/restart.                                          |
| `/parent/learners/[learnerId]/baseline/pending`     | —                                | **Missing** | MOB-PAR-005: baseline pending state.                                                          |
| `/parent/learners/[learnerId]/baseline/summary`     | —                                | **Missing** | MOB-PAR-005: baseline summary.                                                                |
| `/parent/learners/[learnerId]/brain-clone-watch`    | —                                | **Missing** | MOB-PAR-006: brain-clone build/approval cinematic (mobile-only parents cannot approve today). |
| `/parent/learners/[learnerId]/brain-profile`        | `(parent)/brain/[childId]/index` | Parity      | —                                                                                             |
| `/parent/learners/[learnerId]/curriculum`           | —                                | **Missing** | MOB-PAR-007: upload school curriculum (CurriculumManager).                                    |
| `/parent/learners/[learnerId]/gradebook`            | —                                | **Missing** | MOB-PAR-008: parent gradebook (subject averages, per-skill table, recent runs).               |
| `/parent/learners/[learnerId]/homework`             | —                                | **Missing** | MOB-PAR-009: parent homework summary view.                                                    |
| `/parent/learners/[learnerId]/iep`                  | `(parent)/iep/[childId]`         | **Partial** | MOB-PAR-010: IEP review sub-flow parity.                                                      |
| `/parent/learners/[learnerId]/iep/review`           | —                                | **Missing** | MOB-PAR-010: IEP review screen.                                                               |
| `/parent/learners/[learnerId]/lessons`              | —                                | **Missing** | MOB-PAR-011: plain-language per-lesson recaps.                                                |
| `/parent/learners/[learnerId]/milestones`           | `(parent)/milestones/[childId]`  | Parity      | —                                                                                             |
| `/parent/learners/[learnerId]/profile-v2`           | —                                | **Missing** | MOB-PAR-012: profile-v2 metric hub.                                                           |
| `/parent/learners/[learnerId]/progress`             | `(parent)/progress/[childId]`    | Parity      | —                                                                                             |
| `/parent/learners/[learnerId]/sensory`              | —                                | **Missing** | MOB-PAR-013: sensory profile (5 modality cards).                                              |
| `/parent/learners/[learnerId]/settings`             | —                                | **Missing** | MOB-PAR-014: per-learner settings + delete learner.                                           |
| `/parent/learners/[learnerId]/snapshot`             | —                                | **Missing** | MOB-PAR-015: weekly one-glance snapshot.                                                      |
| `/parent/learners/[learnerId]/summary`              | —                                | **Missing** | MOB-PAR-016: learner overall summary.                                                         |
| `/parent/learners/[learnerId]/team`                 | `(parent)/team/[childId]`        | Parity      | —                                                                                             |
| `/parent/learners/[learnerId]/accessibility`        | —                                | **Missing** | MOB-PAR-017: per-learner accessibility form.                                                  |
| `/parent/learners/[learnerId]/accessibility/audio`  | —                                | **Missing** | MOB-PAR-017: per-learner audio prefs.                                                         |
| `/parent/consent`                                   | —                                | **Missing** | MOB-PAR-018: ongoing consent/approvals center (account-level).                                |
| `/parent/consent/[learnerId]`                       | —                                | **Missing** | MOB-PAR-018: per-learner consent (COPPA notice).                                              |
| `/parent/notifications`                             | `(parent)/inbox`                 | **Partial** | MOB-PAR-019: notifications parity (read state, live stream) vs current inbox.                 |
| `/parent/reports`                                   | —                                | **Missing** | MOB-PAR-020: parent reports (weekly metrics + recaps per learner).                            |
| `/parent/schedule`                                  | —                                | **Missing** | MOB-PAR-021: parent schedule (assignments + active lessons).                                  |
| `/parent/privacy`                                   | —                                | **Missing** | MOB-PAR-022: privacy hub.                                                                     |
| `/parent/privacy/data-export`                       | —                                | **Missing** | MOB-PAR-022: data export request.                                                             |
| `/parent/privacy/delete-data`                       | —                                | **Missing** | MOB-PAR-022: data deletion request.                                                           |
| `/parent/settings`                                  | `(parent)/settings`              | Parity      | —                                                                                             |
| `/parent/settings/account`                          | —                                | **Missing** | MOB-PAR-023: account settings sub-screen (display name etc.).                                 |
| `/parent/settings/billing`                          | `(parent)/billing`               | Parity      | —                                                                                             |

## Teacher

| Web route                                  | Mobile screen                    | Status      | Gap / Ticket                                                          |
| ------------------------------------------ | -------------------------------- | ----------- | --------------------------------------------------------------------- |
| `/teacher/home`                            | `(teacher)/index`                | Parity      | —                                                                     |
| `/teacher/learners`                        | —                                | **Missing** | MOB-TCH-001: teacher roster/learners LIST.                            |
| `/teacher/learners/[learnerId]`            | `(teacher)/student/[id]/index`   | Parity      | —                                                                     |
| `/teacher/learners/[learnerId]/curriculum` | —                                | **Missing** | MOB-TCH-002: teacher curriculum manager.                              |
| `/teacher/learners/[learnerId]/iep/draft`  | `(teacher)/student/[id]/iep`     | **Partial** | MOB-TCH-003: AI SMART-goal IEP draft generation parity.               |
| `/teacher/classes`                         | —                                | **Missing** | MOB-TCH-004: classes list.                                            |
| `/teacher/classes/[classId]`               | —                                | **Missing** | MOB-TCH-005: class detail (roster).                                   |
| `/teacher/assignments`                     | —                                | **Missing** | MOB-TCH-006: assignments list.                                        |
| `/teacher/assignments/new`                 | —                                | **Missing** | MOB-TCH-007: create assignment.                                       |
| `/teacher/insights`                        | `(teacher)/student/[id]/insight` | **Partial** | MOB-TCH-008: class-wide insights list (mobile is per-student only).   |
| `/teacher/lesson-plans`                    | `(teacher)/lesson-plan`          | **Partial** | MOB-TCH-009: lesson-plan LIBRARY/list (mobile is single-plan editor). |
| `/teacher/reports`                         | `(teacher)/analytics`            | **Partial** | MOB-TCH-010: classroom mastery-distribution reports parity.           |
| `/teacher/settings`                        | `(teacher)/settings`             | Parity      | —                                                                     |

## Therapist

| Web route             | Mobile screen                     | Status      | Gap / Ticket                                                      |
| --------------------- | --------------------------------- | ----------- | ----------------------------------------------------------------- |
| `/therapist/home`     | `(therapist)/index`               | Parity      | —                                                                 |
| `/therapist/sessions` | `(therapist)/sessions`            | Parity      | —                                                                 |
| `/therapist/reports`  | `(therapist)/client/[id]/reports` | **Partial** | MOB-THR-001: cross-client reports roll-up (mobile is per-client). |
| `/therapist/settings` | `(therapist)/settings`            | Parity      | —                                                                 |

## Caregiver

| Web route                 | Mobile screen                             | Status      | Gap / Ticket                                                            |
| ------------------------- | ----------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `/caregiver/home`         | `(caregiver)/index`                       | Parity      | —                                                                       |
| `/caregiver/learners`     | —                                         | **Missing** | MOB-CGV-001: caregiver learners list (mobile drills in via child/[id]). |
| `/caregiver/observations` | `(caregiver)/child/[childId]/observation` | Parity      | —                                                                       |
| `/caregiver/settings`     | `(caregiver)/settings`                    | Parity      | —                                                                       |
