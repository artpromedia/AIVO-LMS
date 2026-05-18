# Web role-surface route matrix (Sprint 08)

This is the authoritative map of every route in `apps/web-v2` — the
role-grouped Next.js app. It pairs each route with the roles allowed
through `requirePageRole`, the role's home, the BFF endpoints that
feed it, and the state files (loading/error/not-found) that must
cover it. `scripts/route-audit.mjs` (root script `route:audit`)
enforces the structural parts.

## Role homes

| Role           | Home              | Layout                |
| -------------- | ----------------- | --------------------- |
| parent         | `/parent/home`    | `app/parent/`         |
| learner        | `/learner/home`   | `app/learner/`        |
| teacher        | `/teacher/home`   | `app/teacher/`        |
| school_admin   | `/admin/school`   | `app/admin/school/`   |
| district_admin | `/admin/district` | `app/admin/district/` |
| platform_admin | `/admin/platform` | `app/admin/platform/` |

Auth + role-redirect lives in
`apps/web-v2/lib/auth/server.ts::requirePageRole`. A teacher who lands
on `/parent/home` is bounced to `/teacher/home` (Sprint 03 contract).

## State file coverage (Next.js route conventions)

Every role group ships:

| File            | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `loading.tsx`   | suspense fallback for the route segment           |
| `error.tsx`     | error boundary; resets via the `reset()` callback |
| `not-found.tsx` | 404 fallback scoped to this group                 |

Sprint 08 baseline shipped role-scoped versions for parent, learner,
teacher, and admin. `scripts/route-audit.mjs` fails CI if any of these
goes missing.

## Parent surfaces (`app/parent/*`)

| Route                                 | Required consents                                                          | BFF feed                            |
| ------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------- |
| `/parent/home`                        | n/a                                                                        | `/api/bff/me`, `/api/bff/learners`  |
| `/parent/learners`                    | `child_data_collection` (per-learner)                                      | `/api/bff/learners`                 |
| `/parent/learners/new`                | `parent_account_terms` + `parent_privacy_policy` + `child_data_collection` | `POST /api/bff/learners`            |
| `/parent/learners/[learnerId]`        | `child_data_collection`                                                    | `/api/bff/learners/[learnerId]`     |
| `/parent/learners/[id]/assessment`    | `child_data_collection`                                                    | parent-assessment BFFs              |
| `/parent/learners/[id]/iep`           | `iep_document_storage` + `child_data_collection`                           | iep-upload BFFs                     |
| `/parent/learners/[id]/brain-profile` | `ai_personalization` + `child_data_collection`                             | brain-profile BFFs                  |
| `/parent/learners/[id]/baseline`      | `child_data_collection`                                                    | baseline BFFs                       |
| `/parent/learners/[id]/progress`      | `child_data_collection`                                                    | progress BFFs                       |
| `/parent/consent`                     | n/a (manages consent itself)                                               | `/api/bff/consent`                  |
| `/parent/privacy`                     | n/a (DSAR/deletion flows)                                                  | `/api/bff/privacy`                  |
| `/parent/notifications`               | n/a                                                                        | `/api/bff/notification-preferences` |
| `/parent/schedule`                    | n/a                                                                        | `/api/bff/parent/.../schedule`      |
| `/parent/reports`                     | `child_data_collection`                                                    | progress BFFs                       |
| `/parent/settings`                    | n/a                                                                        | `/api/bff/account`                  |

## Learner surfaces (`app/learner/*`)

| Route                                | Required consents                              | Notes                                                            |
| ------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| `/learner/home`                      | `child_data_collection`                        | **Single primary CTA: "Start Today's Mission"** (Sprint 08 rule) |
| `/learner/missions`                  | `child_data_collection` + `ai_personalization` | Today's Mission detail + assignment inbox                        |
| `/learner/baseline`                  | `child_data_collection`                        | Baseline player landing                                          |
| `/learner/baseline/[baselineId]`     | `child_data_collection`                        | Per-baseline player                                              |
| `/learner/lesson-runs/[lessonRunId]` | `child_data_collection` + `ai_personalization` | Lesson player                                                    |
| `/learner/homework`                  | `child_data_collection` + `ai_personalization` | Homework helper                                                  |
| `/learner/quests`                    | `child_data_collection` + `ai_personalization` | Quests                                                           |
| `/learner/library`                   | `child_data_collection`                        | Library                                                          |
| `/learner/progress`                  | `child_data_collection`                        | Plain-language progress                                          |
| `/learner/rewards`                   | n/a                                            | Rewards                                                          |
| `/learner/notifications`             | n/a                                            | Notifications                                                    |
| `/learner/select`                    | n/a                                            | Account learner switcher (when a parent has multiple)            |
| `/learner/settings`                  | n/a                                            | Accessibility preferences                                        |

The learner home **must not show a dashboard tile grid**. One primary
CTA, with the assignment inbox as the secondary surface.

## Teacher surfaces (`app/teacher/*`)

| Route                   | Notes                                                           |
| ----------------------- | --------------------------------------------------------------- |
| `/teacher/home`         | Today's classes + at-risk learners                              |
| `/teacher/classes`      | List of teacher's classes                                       |
| `/teacher/learners`     | List of learners across classes (consented teacher_access only) |
| `/teacher/assignments`  | Assignment list + create                                        |
| `/teacher/lesson-plans` | Lesson plans                                                    |
| `/teacher/insights`     | Class mastery heatmap                                           |
| `/teacher/reports`      | Per-class, per-learner reports                                  |
| `/teacher/settings`     | Account                                                         |

Teacher must never see raw IEP text (Sprint 04 contract). Teacher
surfaces that touch IEP fields must request the
`teacher-safe-iep-summary` view from assessment-svc, not the raw doc.

## Admin surfaces (`app/admin/*`)

| Route               | Roles                              |
| ------------------- | ---------------------------------- |
| `/admin/school/*`   | `school_admin`, `platform_admin`   |
| `/admin/district/*` | `district_admin`, `platform_admin` |
| `/admin/platform/*` | `platform_admin` only              |

Every admin route is tenant-scoped: a school admin cannot see another
school, a district admin cannot see another district. Enforced in the
BFF guard + in `requirePageRole` (which redirects mismatched roles).

## Route audit

`scripts/route-audit.mjs` (root script `route:audit`):

1. Every role group (parent, learner, teacher, admin) has `loading.tsx`,
   `error.tsx`, and `not-found.tsx`.
2. Every `app/{role}/**/page.tsx` calls `requirePageRole` directly OR
   reaches into a layout that does (root admin layout, etc.).
3. The learner home has exactly one primary CTA token (`data-primary-cta`).
4. No `page.tsx` in any role group ships a literal "Coming soon" or
   "TBD" string in JSX text.
