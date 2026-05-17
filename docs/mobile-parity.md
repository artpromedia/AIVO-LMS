# Mobile Parity Audit

Comparison of the Expo mobile app (`apps/mobile/`) against the Next.js web app
(`apps/web/`). Audited on Sprint 7. Status legend:

- **Parity**: feature is present on both with comparable functionality.
- **Partial**: present but missing a sub-feature noted in the gap column.
- **Missing**: not yet implemented in mobile.
- **N/A**: intentionally web-only (e.g. district admin tools).

## Parent Role

| Web Route | Mobile Screen | Status | Gap / Ticket |
|-----------|---------------|--------|--------------|
| `/dashboard/parent` | `(parent)/index.tsx` | Parity | — |
| `/dashboard/parent/onboard` | `(parent)/onboard.tsx` | Parity | — |
| `/dashboard/parent/brain/[id]` | `(parent)/brain/[childId]/index.tsx` | Parity | — |
| `/dashboard/parent/brain/[id]/[domain]` | `(parent)/brain/[childId]/[domain].tsx` | Parity | — |
| `/dashboard/parent/brain/[id]/history` | `(parent)/brain/[childId]/history.tsx` | Parity | — |
| `/dashboard/parent/brain-review/[id]` | — | **Missing** | MOB-PAR-001: parent brain-clone approval flow |
| `/dashboard/parent/iep/[id]` | `(parent)/iep/[childId].tsx` | Parity | — |
| `/dashboard/parent/progress/[id]` | `(parent)/progress/[childId].tsx` | Parity | — |
| `/dashboard/parent/sessions/[id]` | `(parent)/session/[childId].tsx` | Parity | — |
| `/dashboard/parent/team/[id]` | `(parent)/team/[childId].tsx` | Parity | — |
| `/dashboard/parent/colearn/[id]` | `(parent)/colearn/[childId].tsx` | Parity | — |
| `/dashboard/parent/tutors` | `(parent)/tutors.tsx` | Parity | — |
| `/dashboard/parent/recommendations` | `(parent)/recommendations.tsx` | Parity | — |
| `/dashboard/parent/billing` | `(parent)/billing.tsx` | Parity | — |
| `/dashboard/parent/settings` | `(parent)/settings.tsx` | Parity | — |
| `/dashboard/parent/gradebook/[id]` | — | **Missing** | MOB-PAR-002: parent gradebook view (currently only via progress) |

## Learner Role

| Web Route | Mobile Screen | Status | Gap / Ticket |
|-----------|---------------|--------|--------------|
| `/learner` | `(learner)/index.tsx` | Parity | — |
| `/learner/stage/[sessionId]` | `(learner)/stage/[sessionId].tsx` | Parity | — |
| `/learner/tutor/[slug]` | `(learner)/tutor/[tutorSlug].tsx` | Parity | — |
| `/learner/gradebook` | `(learner)/gradebook.tsx` | Parity | — |
| `/learner/homework` | `(learner)/homework.tsx` | Parity | — |
| `/learner/badges` | `(learner)/badges.tsx` | Parity | — |
| `/learner/quests` | `(learner)/quests.tsx` | Parity | — |
| `/learner/challenges` | `(learner)/challenges.tsx` | Parity | — |
| `/learner/shop` | `(learner)/shop.tsx` | Parity | — |
| `/learner/gamification` | `(learner)/gamification.tsx` | Parity | — |
| `/learner/discovery-adventure` | `(learner)/adventure.tsx` | Parity | — |
| `/learner/brain` | `(learner)/brain.tsx` | Parity | — |
| `/learner/sensory-settings` | — | **Missing** | MOB-LRN-001: learner-side sensory toggle screen |

## Caregiver Role

| Web Route | Mobile Screen | Status | Gap / Ticket |
|-----------|---------------|--------|--------------|
| `/dashboard/caregiver` | `(caregiver)/index.tsx` | Parity | — |
| `/dashboard/caregiver/observations` | `(caregiver)/child/[id]/observation.tsx` | Parity | — |
| `/dashboard/caregiver/sessions` | `(caregiver)/child/[id]/sessions.tsx` | Parity | — |
| `/dashboard/caregiver/child/[id]/brain` | `(caregiver)/child/[id]/brain.tsx` | Parity | — |
| `/dashboard/caregiver/child/[id]/iep-goals` | `(caregiver)/child/[id]/iep-goals.tsx` | Parity | — |
| `/dashboard/caregiver/child/[id]/accommodations` | `(caregiver)/child/[id]/accommodations.tsx` | Parity | — |
| `/dashboard/caregiver/child/[id]/gradebook` | `(caregiver)/child/[id]/gradebook.tsx` | Parity | — |
| `/dashboard/caregiver/child/[id]/progress` | `(caregiver)/child/[id]/progress.tsx` | Parity | — |
| `/dashboard/caregiver/settings` | `(caregiver)/settings.tsx` | Parity | — |

## Teacher Role

| Web Route | Mobile Screen | Status | Gap / Ticket |
|-----------|---------------|--------|--------------|
| `/dashboard/teacher` | `(teacher)/index.tsx` | Parity | — |
| `/dashboard/teacher/lesson-plans` | `(teacher)/lesson-plan.tsx` | Partial | MOB-TCH-001: list/library view (only single plan editor on mobile) |
| `/dashboard/teacher/reports` | `(teacher)/analytics.tsx` | Parity | — |
| `/dashboard/teacher/student/[id]` | `(teacher)/student/[id]/index.tsx` | Parity | — |
| `/dashboard/teacher/student/[id]/iep` | `(teacher)/student/[id]/iep.tsx` | Parity | — |
| `/dashboard/teacher/student/[id]/insights` | `(teacher)/student/[id]/insight.tsx` | Parity | — |
| `/dashboard/teacher/settings` | — | **Missing** | MOB-TCH-002: teacher settings screen |

## Therapist Role

| Web Route | Mobile Screen | Status | Gap / Ticket |
|-----------|---------------|--------|--------------|
| `/dashboard/therapist` | `(therapist)/index.tsx` | Parity | — |
| `/dashboard/therapist/caseload` | `(therapist)/index.tsx` | Parity | (combined with home) |
| `/dashboard/therapist/sessions` | `(therapist)/client/[id]/notes.tsx` | Partial | MOB-THR-001: cross-client session log |
| `/dashboard/therapist/reports` | `(therapist)/client/[id]/reports.tsx` | Parity | — |
| `/dashboard/therapist/client/[id]/goals` | `(therapist)/client/[id]/goals.tsx` | Parity | — |
| `/dashboard/therapist/settings` | — | **Missing** | MOB-THR-002: therapist settings screen |

## District / Platform Admin
Intentionally web-only (N/A on mobile): district admin, platform admin, internal
operations, billing reconciliation, integrations management.

## Summary

| Category | Count |
|----------|-------|
| Parity | 36 |
| Partial | 3 |
| Missing | 6 |
| N/A (web-only) | — |

### Pre-launch Tickets
- **MOB-PAR-001** Parent brain-clone approval flow on mobile
- **MOB-PAR-002** Parent gradebook screen on mobile
- **MOB-LRN-001** Learner sensory-settings screen
- **MOB-TCH-001** Teacher lesson-plan library list view
- **MOB-TCH-002** Teacher settings screen
- **MOB-THR-001** Therapist cross-client session log
- **MOB-THR-002** Therapist settings screen

These can ship post-launch since each has a parent-facing or web-equivalent
fallback. The brain-clone approval gap (MOB-PAR-001) is the most user-visible —
parents who only use mobile cannot currently approve the initial clone and must
fall back to the web app for that single step.
