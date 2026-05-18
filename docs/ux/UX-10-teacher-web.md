# UX-10 — Teacher Web

> **Last refreshed**: 2026-05-17 — verified current with three additions to the teacher sitemap since the last refresh: `/teacher/lesson-plans`, `/teacher/reports`, and `/teacher/learners/[id]/iep/draft` (teacher-authored IEP draft workspace). All three are now in the sitemap; the §1 "three jobs" framing is unchanged.
>
> **Source of truth.** Grounded in `apps/web-v2/app/teacher/**` and the teacher‑scoped repo helpers in `apps/web-v2/lib/db/repos.ts`. The teacher app is **partially shipped**: assignments and learner detail are real; class/home views are still scaffolding around demo data.
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

## 1. The teacher's three jobs

A teacher signs into AIVO for three reasons. Every teacher screen must serve one of them; anything else gets cut.

1. **Triage** — _which of my learners need me this morning?_ (low mastery, missed sessions, IEP follow‑ups.)
2. **Assign** — _give this learner / this class targeted practice today._
3. **Translate** — _prep something I can hand to a parent or a co‑teacher_ (insights, accommodations summaries).

Anything that doesn't serve one of those — gradebooks, file managers, third‑party LMS chrome — belongs in a future integration, not the teacher surface.

## 2. Principles

1. **Teachers never see raw IEP text.** Only the `teacherSummary` field and the structured `accommodations[]` are rendered. The safety comment lives in code at `app/teacher/learners/[learnerId]/page.tsx:154-158` — that's the contract.
2. **Tenant scoped, hard.** A teacher visiting a learner from another tenant gets a 404, not an "access denied" page. The check lives in `getLearner(learnerId, session.tenantId)`.
3. **Class‑scoped operations only.** Even platform admins cannot grade or assign on behalf of a teacher. The teacher's `session.userId` is the assignment author and is enforced server‑side.
4. **Real data over filler.** Where data isn't wired, label cards _"Demo data"_ explicitly (see `teacher/home/page.tsx:51`). Never imply a feature that isn't shipped.

## 3. Sitemap

```
/teacher/home                              🟡 placeholder — single hardcoded class card, demo-data badge,
                                              uses a local nav array (not shared TEACHER_NAV)
/teacher/classes                           ✅ list of classrooms scoped to teacherUserId
/teacher/classes/[classId]                 🟡 roster shows subjectId not displayName (cosmetic bug)
/teacher/learners                          ✅ list of learners across the teacher's classes
/teacher/learners/[learnerId]              ✅ recent lessons, skill gaps, accommodations, active assignments
/teacher/assignments                       ✅ list teacher's assignments + "New assignment" CTA
/teacher/assignments/new                   ✅ create form — subject + skills + learners + due date
/teacher/insights                          ✅ real per-learner mastery + recent activity tiles
/teacher/settings                          🟡 link out to /settings/* shared shell
```

There is **no** `/teacher/assignments/[assignmentId]` detail route — the list is the only view today; editing/archiving an existing assignment is a real gap.

### Navigation (✅)

`TEACHER_NAV` in `components/layout/role-shells.tsx` (the shared, role-aware array used by every teacher page _except_ `/teacher/home`, which redeclares its own local copy without the _Learners_ item):

| Label       | Icon            | Status                                         |
| ----------- | --------------- | ---------------------------------------------- |
| Home        | `Home`          | 🟡 placeholder content                         |
| Classes     | `Users`         | 🟡 list works; detail has roster cosmetics bug |
| Learners    | `Users`         | ✅                                             |
| Assignments | `ClipboardList` | ✅                                             |
| Insights    | `BarChart3`     | ✅                                             |
| Settings    | `Settings`      | 🟡 shared shell                                |

**Two small nav follow-ups:** (1) replace the local `TEACHER_NAV` in `teacher/home/page.tsx:11-17` with the shared import so _Learners_ appears there too; (2) consider a different icon for _Learners_ so it doesn't collide visually with _Classes_.

## 4. Screen — `/teacher/home` (🟡)

Source: `teacher/home/page.tsx` (63 lines). **This is the highest‑priority gap in the teacher app.** Today the page renders:

- PageHeader: _"Good to see you, {firstName}"_ / _"Review classes, spot learners who need a nudge, and assign next steps."_
- A disabled _"New assignment (Sprint 16)"_ button — the new‑assignment flow is now live; this label is stale and should drop the sprint tag.
- Section header: _"Your classes — Live class rosters will appear here once Sprint 15 wires them up."_
- One hardcoded card _"3rd Grade · Room 12 — 22 learners · 3 IEPs · 2 awaiting baseline"_ with a _Demo data_ badge and a disabled _"Open class (Sprint 15)"_ button.
- One empty state _"Add another class — Roster sync from Google Classroom, Clever, or ClassLink lands in Sprint 19."_

### What it should be (⬜)

The teacher home is the **triage screen**, not a class directory. Class directory belongs at `/teacher/classes`. Proposed structure:

1. **Today** — _3 learners need attention._ List items, each linking to `/teacher/learners/[id]`:
   - _Sky_ — _No lesson started in 4 days._
   - _River_ — _Struggling on CVC words (4 sessions, score stuck at 42 %)._
   - _Theo_ — _IEP review due Friday._
     The signals come from existing repo data:
   - `listLessonRunsForLearner` with no recent `startedAt`.
   - `SkillMastery` rows with `score ≤ 0.5` and no movement across the last N runs.
   - 🟡 IEP review date is not stored; add `IEPDocument.reviewDueAt` if Triage Card #3 is desired.
2. **My classes** — small horizontal scroller of real `Classroom` records.
3. **Active assignments** — the 5 most recent `TeacherAssignment` rows + their completion %.
4. **Insights link** — single soft button into `/teacher/insights` when it ships.

### Microcopy targets

- _"3 learners need attention this morning."_ (header)
- _"All caught up — no urgent flags today."_ (empty)
- Per‑item secondary action: _Open profile_ (not _View_, not _Details_).

## 5. Screen — `/teacher/classes/[classId]` (🟡)

Source: `teacher/classes/[classId]/page.tsx` (49 lines).

Works:

- Tenant scoping via `getClassroom(classId, tenantId)`.
- Ownership check: `classroom.teacherUserId !== session.userId` → 404.
- Renders a roster with each enrollment.

**Bug to fix in this sprint:** the roster renders `e.subjectId` as the row label, which is the enrollment's subject‑id (often empty), not the learner's display name. The fix is two lines:

1. Add `getLearner(enrollment.learnerUserId, tenantId)` per row.
2. Render `learner.displayName` with a `LearnerAvatar`.

## 6. Screen — `/teacher/learners/[learnerId]` (✅)

Source: `teacher/learners/[learnerId]/page.tsx` (173 lines). This is the strongest page in the teacher app and should be the model for the rest.

### Sections (top to bottom)

1. **Header** — _Learner_ eyebrow, name, _"Functioning level {n} · {readinessState}"_ meta.
2. **Active assignments** — list of `TeacherAssignment` rows with creation date + due date.
3. **Recent lessons** — last 10 runs with subject · skill, source, started timestamp, status badge.
4. **Skill gaps** — top 5 `SkillMastery` rows with `score ≤ 0.5`, sorted ascending, shown with a `warning`‑tone percentage badge.
5. **Accommodations (teacher summary)** — only `iep.extraction.teacherSummary` text + the structured accommodations list. **Raw IEP text and parent/learner summaries are deliberately suppressed.**

### What it doesn't (yet) have

- 🟡 No quick _"Assign a lesson on this gap"_ action on the skill‑gap rows. The repo and BFFs exist (`/teacher/assignments/new`) — the link‑with‑preselected‑skill flow is a 1‑file addition: pass `?subjectId=…&skillId=…&learnerIds=…` to the new‑assignment route.
- ⬜ No timeline / engagement chart. Engagement data is computed; widget not built.
- 🟡 No homework‑helper visibility from the teacher view. Teachers can legitimately benefit from seeing the parent‑facing insight summaries; consider adding a read‑only _"Recent homework sessions"_ section.

## 7. Screen — `/teacher/assignments` & `/teacher/assignments/new` (✅)

Source: `teacher/assignments/page.tsx` (74 lines) + the `new` route.

### List

- Header: _Assignments_ / _"Set work for individual learners. Assigned work appears on the learner's Today screen."_
- Primary action: **New assignment** → `/teacher/assignments/new`.
- Each row: title, subject name + learner count + created date, instructions excerpt, status badge (`active` / `archived`).
- Empty: _"No assignments yet. Create one to give a learner targeted practice."_

### New assignment form (✅)

Fields:

| Field        | Required | Source                                            |
| ------------ | -------- | ------------------------------------------------- |
| Title        | ✓        | free text                                         |
| Instructions | optional | free text, multiline                              |
| Subject      | ✓        | `listSubjects()`                                  |
| Skills       | ≥ 1      | `listSkills(subjectId)`                           |
| Learners     | ≥ 1      | `listLearnersForTeacher(teacherUserId, tenantId)` |
| Due date     | optional | date picker                                       |

Server action:

1. `requirePageRole(["teacher"])`.
2. Validate skills belong to the chosen subject (defensive — UI filters already).
3. Validate every learner is in this teacher's tenant.
4. `createTeacherAssignment({ teacherId: session.userId, … })`.
5. `audit(session, "teacher.assignment.create", …)`.

### Surface on the learner side

A new active assignment is hoisted to slot 2 of `pickTodaysMission` (`today.ts:131-170`) and the learner sees:

> _Your teacher set this for today: {title}._

When the learner finishes the run, the completion is matched back to `sourceRefId === assignment.id` and the assignment is considered done for that learner.

## 8. Screen — `/teacher/insights` (✅)

Source: `teacher/insights/page.tsx`. Real data, no placeholders. Layout:

- PageHeader: _"Teacher" / "Insights" / "Recent mastery and lesson activity across your roster."_
- For each learner in `listLearnersForTeacher(teacherUserId, tenantId)`, a card showing recent mastery + lesson activity (subject and skill names resolved via the in-page subject/skill maps).
- Empty state: _"No learners in your tenant — Once learners are rostered, their skill mastery and lesson activity will appear here."_

### Gaps worth closing next sprint

- **Skill heatmap (⬜)** — subject × skill, cell colour = average mastery; click-through filters `/teacher/learners` to learners under 50 %.
- **Class-level rollup (⬜)** — today _Insights_ iterates learners individually; a class-by-class summary header would help triage.
- **Assignment completion (⬜)** — % of assignees done per active assignment. All inputs exist (`listTeacherAssignments` + run completion match on `sourceRefId`); the widget doesn't.

## 9. Microcopy bank

| Surface                    | String                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Home greeting              | _"Good to see you, {firstName}"_                                                      |
| Home triage header         | _"Needs attention today"_ (⬜ proposed)                                               |
| Empty triage               | _"All caught up — no urgent flags today."_ (⬜ proposed)                              |
| Assignment empty           | _"No assignments yet. Create one to give a learner targeted practice."_               |
| Assignment status `active` | _"active"_ (badge primary)                                                            |
| Learner safety footer      | (none — silence is intentional)                                                       |
| Learner gap badge          | _"{percent}%"_ (warning tone)                                                         |
| Roster empty               | _"No learners yet. Ask your school admin to assign learners or run a roster import."_ |

## 10. State matrix

| Screen           | State                      | UX                                                                                                                                                                                   |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home             | No classes                 | Empty card _"You're not on a class roster yet."_ (⬜)                                                                                                                                |
| Classes          | 0 classes                  | Same empty card                                                                                                                                                                      |
| Class detail     | Roster 0 learners          | _"No learners yet. Ask your school admin…"_                                                                                                                                          |
| Learner detail   | Cross‑tenant id in URL     | `notFound()`                                                                                                                                                                         |
| Learner detail   | No mastery                 | Skill gaps card _"No notable gaps yet — keep going."_                                                                                                                                |
| Learner detail   | No IEP                     | Section hidden entirely                                                                                                                                                              |
| Assignment new   | Subject changed            | Skills list re‑queries                                                                                                                                                               |
| Assignment new   | 0 learners in class roster | Roster card renders an inline _"No learners yet…"_ empty state; the submit button itself is only disabled while a save is in flight (`disabled={busy}`, label flips to _"Saving…"_). |
| Assignments list | 0 active + 0 archived      | Empty card                                                                                                                                                                           |

## 11. Engineering handoff

| Concern                | Where                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Nav                    | `components/layout/role-shells.tsx` — `TEACHER_NAV`                                                    |
| Roster gap (§5 bug)    | `app/teacher/classes/[classId]/page.tsx:38-43`                                                         |
| Triage signals         | `listLessonRunsForLearner`, `getMasteryMap`, `IEPDocument` (add `reviewDueAt` if §4 row 3 is in scope) |
| Assignment server flow | `createTeacherAssignment` in `lib/db/repos.ts`; mission hoist in `lib/learner/today.ts:131-170`        |
| IEP safety contract    | `app/teacher/learners/[learnerId]/page.tsx:154-158` — DO NOT widen the rendered fields                 |
| Tenant scoping         | every page calls `requirePageRole(["teacher"])` and re-checks `tenantId` on every repo call            |
| Audit                  | actions: `teacher.assignment.create`, `teacher.assignment.archive`, `teacher.learner.view`             |

## 12. Acceptance criteria — honest

- ✅ Teachers can only see learners + classes in their own tenant.
- ✅ Raw IEP text is not rendered on any teacher screen.
- ✅ New assignment lands on the learner's Today screen at priority slot 2, even if the learner hasn't finished baseline.
- ✅ A teacher cannot edit another teacher's assignment (server enforces `teacherId === session.userId`).
- 🟡 `/teacher/home` is still scaffolding — labelled _Demo data_, with stale "Sprint 15/16/19" disabled CTAs. Replace with the triage screen in §4 before the teacher app is shippable.
- 🟡 `/teacher/classes/[classId]` roster shows the wrong field (subjectId vs learner name). Two‑line fix in §5.
- ✅ `/teacher/insights` is implemented (per-learner mastery + recent activity); class-level rollup and skill heatmap are still ⬜.
- ⬜ No `/teacher/assignments/[assignmentId]` detail/edit route — assignment archiving and editing are not yet available in the UI.
- ⬜ Skill‑gap rows don't deep‑link into the new‑assignment form with the skill preselected.

## 13. Open questions

1. Should a teacher be able to **start a lesson live** with a learner ("co‑lesson" mode) or only assign for asynchronous work? Current build: assign only.
2. Where does the teacher invite a co‑teacher? Today this is implicit (admin assigns staff). If we want teachers to invite, the BFF is missing.
3. Engagement insights (XP, streaks) are not on the teacher surface today. Confirm whether they belong here or stay strictly parent/learner concepts.
