# AIVO Navigation, Routes, and Permissions

> Single source of truth: [`packages/nav/src/`](../packages/nav/src/).
> If this doc and the registry disagree, the registry wins. Update the
> doc when you change the matrix.

## Roles

| ID              | Label          | On web | On mobile | Step-up required |
| --------------- | -------------- | ------ | --------- | ---------------- |
| `learner`       | Learner        | yes    | yes       | no               |
| `parent`        | Parent         | yes    | yes       | yes              |
| `teacher`       | Teacher        | yes    | yes       | yes              |
| `schoolAdmin`   | School admin   | yes    | no        | yes              |
| `districtAdmin` | District admin | yes    | no        | yes              |
| `internal`      | Internal       | yes    | no        | yes              |

Step-up = the role switcher prompts for biometric / PIN before
entering the role even when the user is already authenticated.

## Navigation areas

The 16 areas below are the only top-level shell destinations. To add
anything new, add it to [`packages/nav/src/areas.ts`](../packages/nav/src/areas.ts)
first.

| Area             | Label           | Description                              |
| ---------------- | --------------- | ---------------------------------------- |
| `home`           | Home            | Daily overview                           |
| `learners`       | Learners        | Students you are responsible for         |
| `subjects`       | Subjects        | Curriculum, courses, standards           |
| `baseline`       | Baseline        | Diagnostics and starting points          |
| `lessons`        | Lessons         | Today's lessons / lesson plans           |
| `homeworkHelper` | Homework Helper | Guided homework with the AI helper       |
| `aiTutor`        | AI Tutor        | Conversational tutor                     |
| `progress`       | Progress        | Mastery, streaks, goals                  |
| `iep`            | IEP / Supports  | IEPs, 504s, accommodations               |
| `messages`       | Messages        | Threads with teachers, families, AIVO    |
| `approvals`      | Approvals       | Pending consents and content approvals   |
| `billing`        | Billing         | Subscriptions, invoices, payment methods |
| `settings`       | Settings        | Account, privacy, accessibility          |
| `admin`          | Admin           | Roster, staff, classes, compliance       |
| `safety`         | Safety          | Safety signals, escalations, reviews     |
| `reports`        | Reports         | Outcomes, attendance, compliance         |

## Access levels

Every (role, area) pair resolves to exactly one of:

| Access   | Meaning                                                                       |
| -------- | ----------------------------------------------------------------------------- |
| `full`   | Primary destination — appears in sidebar / bottom tabs.                       |
| `linked` | Available via secondary menus / sub-pages, not the primary nav.               |
| `locked` | Visible but blocked. A locked screen explains why with a `lockReason` string. |
| `hidden` | Never shown. The role does not see the area exists.                           |

`hidden` is used sparingly. Prefer `locked` so users understand the
shape of the product even when they can't enter an area.

## Permission matrix

`F` = full, `L` = linked, `🔒` = locked, blank = hidden.

| Area           | Learner | Parent | Teacher | School admin | District admin | Internal |
| -------------- | :-----: | :----: | :-----: | :----------: | :------------: | :------: |
| home           |    F    |   F    |    F    |      F       |       F        |    F     |
| learners       |         |   F    |    F    |      F       |       L        |    F     |
| subjects       |    F    |   L    |    L    |      L       |       L        |    L     |
| baseline       |    L    |   🔒   |    L    |      L       |       L        |    L     |
| lessons        |    F    |   L    |    F    |      L       |       L        |    L     |
| homeworkHelper |    F    |   🔒   |   🔒    |      🔒      |       🔒       |    L     |
| aiTutor        |    F    |   🔒   |   🔒    |      🔒      |       🔒       |    L     |
| progress       |    F    |   F    |    F    |      L       |       L        |    L     |
| iep            |   🔒    |   L    |    L    |      L       |       F        |    L     |
| messages       |    L    |   F    |    F    |      L       |       L        |    L     |
| approvals      |   🔒    |   F    |    L    |      L       |       L        |    L     |
| billing        |   🔒    |   L    |   🔒    |      F       |       F        |    F     |
| settings       |    L    |   L    |    L    |      L       |       L        |    L     |
| admin          |         |        |         |      F       |       F        |    F     |
| safety         |         |   🔒   |    L    |      L       |       L        |    F     |
| reports        |         |   L    |    L    |      F       |       F        |    F     |

### Locked-state copy

These strings render verbatim on `/locked/[area]` (web) and the
`<LockedScreenMobile>` sheet (mobile). Update them in
[`packages/nav/src/permissions.ts`](../packages/nav/src/permissions.ts).

- **Learner → IEP**: "Your IEP and supports are visible to your parent and teacher. Ask them if you have questions about your accommodations."
- **Learner → Billing**: "Only the grown-up on your account can see billing."
- **Learner → Approvals**: "A parent approves new content for you."
- **Parent → Baseline**: "Baselines are run by your child's teacher. You'll see results in Progress once they are complete." → CTA: _Open Progress_.
- **Parent → Homework Helper**: "Homework Helper is your child's tool. You can supervise sessions from Approvals." → CTA: _Open Approvals_.
- **Parent → AI Tutor**: "AI Tutor sessions belong to your child. Review transcripts from each learner's profile."
- **Parent → Safety**: "Safety reviews are handled by school staff and AIVO. We will message you if anything needs your attention."
- **Teacher → Homework Helper**: "Homework Helper is a learner-facing tool. You can review session transcripts from each student's profile."
- **Teacher → AI Tutor**: "AI Tutor conversations belong to learners. Open a student profile to read their transcripts."
- **Teacher → Billing**: "Billing is handled by your school admin."
- **School admin → Homework Helper / AI Tutor**: "Use Reports for aggregate usage data."
- **District admin → Homework Helper / AI Tutor**: "District-level usage lives in Reports."

## Route map

`F` and `L` accesses bind to concrete paths on each surface. `🔒`
always resolves to `/locked/[area]` (web) or pushes
`<LockedScreenMobile>` (mobile).

### Learner

| Area           | Web                      | Mobile                |
| -------------- | ------------------------ | --------------------- |
| home           | `/learner/home`          | `/(learner)/home`     |
| subjects       | `/learner/subjects`      | `/(learner)/subjects` |
| lessons        | `/learner/lesson-runs`   | `/(learner)/lessons`  |
| homeworkHelper | `/learner/homework`      | `/(learner)/homework` |
| aiTutor        | `/learner/quests`        | `/(learner)/tutor`    |
| progress       | `/learner/progress`      | `/(learner)/progress` |
| baseline       | `/learner/baseline`      | `/(learner)/baseline` |
| settings       | `/learner/settings`      | `/(learner)/settings` |
| messages       | `/learner/notifications` | `/(learner)/messages` |

### Parent

| Area      | Web                        | Mobile                |
| --------- | -------------------------- | --------------------- |
| home      | `/parent/home`             | `/(parent)/home`      |
| learners  | `/parent/learners`         | `/(parent)/learners`  |
| progress  | `/parent/reports`          | `/(parent)/progress`  |
| approvals | `/parent/consent`          | `/(parent)/approvals` |
| messages  | `/parent/notifications`    | `/(parent)/messages`  |
| iep       | `/parent/learners`         | `/(parent)/iep`       |
| billing   | `/parent/settings/billing` | `/(parent)/billing`   |
| settings  | `/parent/settings`         | `/(parent)/settings`  |
| subjects  | `/parent/learners`         | `/(parent)/subjects`  |
| lessons   | `/parent/schedule`         | `/(parent)/lessons`   |
| reports   | `/parent/reports`          | `/(parent)/reports`   |

### Teacher

| Area      | Web                     | Mobile                 |
| --------- | ----------------------- | ---------------------- |
| home      | `/teacher/home`         | `/(teacher)/home`      |
| learners  | `/teacher/learners`     | `/(teacher)/learners`  |
| lessons   | `/teacher/lesson-plans` | `/(teacher)/lessons`   |
| progress  | `/teacher/insights`     | `/(teacher)/progress`  |
| messages  | `/teacher/learners`     | `/(teacher)/messages`  |
| subjects  | `/teacher/lesson-plans` | `/(teacher)/subjects`  |
| baseline  | `/teacher/assignments`  | `/(teacher)/baseline`  |
| iep       | `/teacher/learners`     | `/(teacher)/iep`       |
| approvals | `/teacher/assignments`  | `/(teacher)/approvals` |
| reports   | `/teacher/reports`      | `/(teacher)/reports`   |
| safety    | `/teacher/learners`     | `/(teacher)/safety`    |
| settings  | `/teacher/settings`     | `/(teacher)/settings`  |

### School admin

| Area     | Web                        |
| -------- | -------------------------- |
| home     | `/admin/school`            |
| learners | `/admin/school/learners`   |
| admin    | `/admin/school/staff`      |
| reports  | `/admin/school/reports`    |
| billing  | `/admin/school/billing`    |
| safety   | `/admin/school/compliance` |
| iep      | `/admin/school/compliance` |
| subjects | `/admin/school/classes`    |
| settings | `/admin/school/settings`   |

### District admin

| Area     | Web                          |
| -------- | ---------------------------- |
| home     | `/admin/district`            |
| admin    | `/admin/district/schools`    |
| reports  | `/admin/district/reports`    |
| billing  | `/admin/district/billing`    |
| iep      | `/admin/district/iep`        |
| safety   | `/admin/district/compliance` |
| settings | `/admin/district/settings`   |

### Internal

| Area     | Web                             |
| -------- | ------------------------------- |
| home     | `/admin/platform`               |
| admin    | `/admin/platform/tenants`       |
| learners | `/admin/platform/learners`      |
| safety   | `/admin/platform/safety`        |
| reports  | `/admin/platform/system-health` |
| billing  | `/admin/platform/billing`       |
| settings | `/admin/platform/settings`      |

## Shell composition rules

### Web (`@aivo/ui/shell`)

- `AppShell` always renders `Sidebar` + `CommandBar` + `PageContainer`.
- `Sidebar` shows `full`-access areas in the primary group and
  `linked`-access areas in a "More" group. `locked` rows appear at
  the bottom under "Restricted" so users can see them with a lock
  glyph, but click-through goes to `/locked/[area]`.
- `CommandBar` always exposes: search, notifications, role switcher,
  account menu, help. The role switcher only lists roles where
  `ROLE_META[role].onWeb === true` and the user has membership.
- `Breadcrumbs` derive from the current pathname and the registry —
  apps do not hand-roll trails.
- `PageContainer` is the only acceptable outer wrapper for a dashboard
  view; it provides the soft glass card, the page heading, optional
  action slot, and reduced-motion-safe transitions.

### Mobile (`@aivo/mobile-ui/shell`)

- `RoleAwareTabBar` shows at most 5 tabs. The learner role is
  intentionally simplified to 3 tabs (home, lessons, AI tutor) — see
  the matrix above; this is age-appropriate, not arbitrary.
- `RoleSwitcherSheet` is a bottom sheet that lists every role the
  user has access to. Roles where `requiresStepUp === true` route
  through `onStepUp` rather than `onSelect`; the host app implements
  biometric / PIN there.
- `LockedScreenMobile` renders the same `lockReason` string used on
  web. It is the only place a locked area should be visible to a
  learner — never put a locked area in the tab bar.

## Acceptance checks (Sprint 2)

- [x] No dead nav items — `resolveRoute()` returns `null` for hidden;
      `/locked/[area]` for locked; an existing path for full / linked.
- [x] Every locked entry carries a `lockReason`.
- [x] Single mobile app supports all five non-internal roles.
- [x] Learner mode is structurally simplified (3 tabs, locked IEP /
      billing / approvals with kid-friendly copy).
- [x] Parent + teacher modes expose supervision, approvals, messages,
      progress as primary tabs.
- [x] Role switcher gates parent / teacher / admin / district / internal
      behind step-up.

## How to add a new area

1. Add the ID to `NavArea` in [`packages/nav/src/areas.ts`](../packages/nav/src/areas.ts).
2. Add a row to `NAV_AREA_META` with label, AivoIcon name, description.
3. For each role that should see it, add an entry to that role's
   block in [`packages/nav/src/permissions.ts`](../packages/nav/src/permissions.ts) — be explicit, no defaults.
4. Add a row to the matrix and the relevant route maps in this doc.
5. Build the destination page and any locked-state copy.

## How to change a role's access

1. Update only the matrix in `permissions.ts`. Do not edit the shell
   primitives or any role dashboard to "hide" something — that creates
   ghost code that nobody can audit.
2. Update this doc.
3. Re-run web + mobile type-check.
