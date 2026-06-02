# 0035 — School admin functional parity: bulk import, classrooms & school-scoped ops

- **Status:** Accepted
- **Date:** 2026-06-02
- **Deciders:** Platform Engineering, School Operations Working Group
- **Related:** Sprint 6 "School Admin Functional Parity Pack",
  `packages/learner-import/`, `services/admin-svc/src/routes/schools/`,
  `apps/web-v2/src/features/csv-import/`, `@aivo/scheduling`,
  ADR 0020 (single shell, multi-role identity / active-role RBAC),
  ADR 0033 (district seat pooling), ADR 0034 (data governance, COPPA),
  `docs/audit-event-taxonomy.md`.

## Context

AIVO is sold to districts (ADR 0033), but the day-to-day operational
unit is the **school**. A `district_admin` has long had a full console —
they move seats between schools, run reports across the district, manage
notification policy, and read audit. The `school_admin` persona, by
contrast, had only a thin slice: invite staff, view a flat learners
list, and accept seats allocated down from the district pool.

That gap does not match how schools actually run. A school office
onboards a new cohort every August, re-sections learners into classrooms
every term, runs the same roster/utilization/compliance reports a
district does (just scoped to one building), and wants to control which
notifications its families receive — none of which a `school_admin` could
do without escalating to a `district_admin`. The pattern in the field
was district admins doing per-school clerical work, or schools emailing
spreadsheets to the district to be imported on their behalf.

Sprint 6 brings the `school_admin` persona to **functional parity with
`district_admin` for single-school operations**. Concretely, schools
need:

- **Bulk learner onboarding from a CSV.** An office exports a roster from
  their SIS and needs to create hundreds-to-thousands of learners at
  once, with the bad rows caught *before* anything is written, not after
  a half-applied import.
- **Classroom CRUD and roster management.** Sections are the unit
  teachers and learners are assigned to; the school owns them, not the
  district.
- **School-scoped reports, audit, and notification policy.** The same
  tooling a district has, bounded to one tenant.

Two constraints shaped the design. First, a bulk import of thousands of
rows is a long operation that **must survive a worker restart** without
double-creating learners — a killed import that re-applies rows on resume
is worse than no import. Second, the sprint brief assumed a BullMQ/Redis
job queue, but **the repository has no BullMQ and no Redis**: background
work runs on `@aivo/scheduling` with in-process runners. We resolve that
mismatch explicitly below rather than smuggling a new infra dependency
into a parity sprint.

## Decision

We will ship a shared, dependency-free import package; a resumable
persisted-cursor import job modelled on a BullMQ-shaped contract but
backed by our existing scheduler; school-scoped `admin-svc` routes under
the same active-role RBAC rule the platform already uses; and a reusable
front-end import wizard, report registry, and notification matrix in
`web-v2`.

### 1. `@aivo/learner-import` — a pure parse/validate/apply package

A new shared package `packages/learner-import/` holds the import logic as
**pure, dependency-free** functions, so it can run identically in a Node
worker, in a unit test, and (for parse + validate only) in the browser
for the wizard's dry run. It has three parts:

- **Parser.** A from-scratch CSV parser — no third-party CSV dependency —
  that handles quoting, embedded newlines, and BOM, and returns rows as
  string maps keyed by header.
- **Validator.** Enforces the import contract:
  - **Required columns:** `external_id`, `first_name`, `last_name`,
    `grade`, `dob`.
  - **Optional columns:** `email_parent`, `language_pref`, `iep_flag`,
    `504_flag`.
  - **Hard errors (block the row):** a malformed `dob`, a `grade` outside
    `0–12`, and a **duplicate `external_id` within the file**.
  - **Warning (non-blocking):** a learner under 13 with no
    `email_parent`. This is a **COPPA** signal (verifiable parental
    consent, ADR 0034) surfaced to the operator, but it is explicitly
    *not* a hard error — onboarding a learner is not blocked on a parent
    email being present in the SIS export.
- **Import engine.** A chunked, **resumable** apply that consumes
  validated rows and creates/updates learners, driven by a persisted
  cursor (§2).

Validation is the single source of truth for what is and isn't
admissible. The wizard, the `validate` route, and the `run` route all
call the same package, so the dry-run preview a school admin sees and the
job that actually runs cannot disagree.

### 2. Resumable persisted-cursor jobs, not BullMQ + Redis

The import runs as a **background job that is resumable**. Progress is a
**persisted cursor** — a row recording the import job's id, the validated
row offset reached, and a per-row apply status. A worker killed mid-run
**rehydrates the cursor and continues** from the last committed offset.

Apply is **idempotent on `external_id`**: re-processing a row that was
already applied (because the cursor was written just after the apply but
before the offset advanced, say) is a no-op, never a second learner. This
is what makes "resume" safe — resumability comes from cursor persistence
plus idempotent apply, not from a queue replaying a message.

**Deviation from the sprint brief (BullMQ).** The brief specified BullMQ.
The codebase has no BullMQ and no Redis; background work is
`@aivo/scheduling` with in-process runners. Rather than introduce Redis
for one sprint, we **model a BullMQ-shaped job contract** —
`enqueue → run → progress → complete/fail`, addressable by `jobId`,
pollable for status — **backed by a persisted-cursor runner** on
`@aivo/scheduling`. We get the ergonomics the brief wanted (a job handle,
a progress signal, a status poll) without the infra:

- **No new infra dependency.** No Redis to provision, secure, or page on.
- **Resumability via cursor persistence**, not a queue's built-in retry.
  Our durability story is "the cursor is in the database we already run",
  which is stronger for an *idempotent, restart-safe* import than at-least
  -once message redelivery would be — redelivery without idempotency is
  exactly the double-apply we must avoid.

If a queue is later justified platform-wide, the BullMQ-shaped contract
means the runner can be swapped behind it without changing callers.

### 3. `admin-svc` school-scoped routes

`admin-svc` gains routes under
`services/admin-svc/src/routes/schools/{schoolId}/`:

- **Import.**
  - `POST .../learners/import/validate` — parse + validate an uploaded
    CSV, return the structured validation report (errors, warnings, row
    counts). No writes.
  - `POST .../learners/import/run` — enqueue the resumable import job;
    returns a `jobId`.
  - `GET .../learners/import/{jobId}` — poll job status and progress.
- **Classrooms.** Full CRUD for classrooms and their rosters.
- **Reports.** A **report registry** plus a **parameterized run**
  endpoint (§4).
- **Notifications.** CRUD for the school's **notification preference
  matrix** (§5).

### 4. Report registry pattern

Reports are not bespoke endpoints. A **registry** lists the available
report definitions — each with an id, a parameter schema, the scope it
runs at, and a producer — and a single parameterized **run** endpoint
executes a registered report against validated parameters, emitting
CSV or PDF. Adding a report is registering a definition, not adding a
route. The same registry is what the front-end catalog renders (§6), so
the catalog cannot drift from what the backend can actually run.

### 5. School notification preference matrix

The school's notification policy is a **matrix** — event type × channel ×
audience — stored and edited per school. CRUD lives behind the school
routes; changes are audited (§ below). This is the school-scoped analogue
of district notification policy, bounded to one tenant.

### 6. `web-v2` front-end: reusable wizard, catalog, matrix, job tray

- **`CsvImportWizard`** — a **reusable** five-step wizard in
  `apps/web-v2/src/features/csv-import/`:
  1. **Download template** — a correct CSV header template.
  2. **Upload** — select the file.
  3. **Column mapping with auto-detect** — map source columns to the
     contract, pre-filled by header auto-detection, operator-overridable.
  4. **Validation report** — the §1 report rendered inline, with a
     **downloadable error CSV** of just the failing rows and their
     reasons, so the office can fix the source and re-upload.
  5. **Dry-run preview, then confirm** — a preview of what *would* be
     created, then confirm to kick off the **background job**, with
     **progress** and a completion **toast**.
- **Classroom pages** — classroom CRUD and roster management.
- **Report catalog + runner** — renders the §4 registry, collects
  parameters, runs a report, and exports **CSV or PDF**.
- **School-level notification matrix** — the §5 matrix as an editable
  grid.
- **Job tray in the `AppShell`** — a component that surfaces in-flight
  and recently completed background jobs (the import being the first
  consumer), so a long import is visible app-wide, not trapped on the
  wizard's last step.

The wizard, catalog, and job tray are built as reusable surfaces — the
import is their first consumer, not their only intended one.

### 7. RBAC — the school-OR-district-OR-platform rule (active role, ADR 0020)

Every route above keys off the **active role** (ADR 0020) and requires:

> **`school_admin` on the target school** OR **`district_admin` on that
> school's parent district** OR **`platform_admin`.**

This is the same scoping rule the platform already uses for school-scoped
resources, reused rather than reinvented: a district admin retains full
reach into every school they own (they can still run a school's import or
edit its classrooms), a school admin is bounded to their building, and
platform admin is global. No route introduces a fourth shape of
authorization.

### 8. Audit

Every mutating operation emits an `audit_events` entry
(`docs/audit-event-taxonomy.md`): the **bulk import summary** (counts
created/updated/skipped, who ran it, against which school), **classroom
create/update/delete**, **roster changes**, and **notification matrix
changes**. The import emits one summary event for the run rather than one
per row, so audit records the operator's intent without drowning in
per-learner noise.

## Consequences

**Positive**

- A school office onboards a cohort, sections it, runs its reports, and
  sets its notification policy **without escalating to a district admin**
  — the parity the sprint set out to deliver, scoped to one building.
- The import is **restart-safe by construction**: a worker can die
  mid-run and resume without double-creating learners, because the cursor
  is persisted and apply is idempotent on `external_id`.
- **No new infrastructure.** We did not add Redis to a parity sprint; the
  job runs on `@aivo/scheduling` we already operate.
- **One validation contract** shared by the wizard preview, the
  `validate` route, and the running job means the dry run a school admin
  approves is exactly what executes.
- The **report registry** and **CsvImportWizard** are reusable surfaces;
  the next report and the next bulk import are configuration/composition,
  not new endpoints and new screens.
- RBAC reuses the existing school-OR-district-OR-platform rule, so the
  blast radius of the new routes is well-understood and consistent with
  the rest of the admin surface.

**Negative / risks**

- **The cursor + idempotent apply is the highest-risk piece.** If apply
  were not truly idempotent on `external_id`, a resume would double-create
  learners. Idempotency is enforced in the apply path and is the
  invariant to defend in review, the way the pool invariant is in ADR
  0033.
- **The BullMQ-shaped-but-not-BullMQ contract is a deliberate
  deviation.** It must be documented (this ADR) so a future engineer
  doesn't go looking for a Redis queue that isn't there, and so the swap
  path — should a real queue ever be justified — is understood.
- **The COPPA warning is non-blocking.** Importing a sub-13 learner with
  no parent email succeeds with a warning. That is intentional (it must
  not block onboarding), but it means parent-email completeness is an
  *operational* follow-up surfaced in the report, not a guarantee the
  import enforces. The verifiable-parental-consent obligation itself lives
  in ADR 0034.

**Non-functional commitments**

- **Performance budget:** a **10,000-row** import validates and applies
  in **under 90 seconds**. The chunked engine and the pure validator are
  sized to this budget; it is the regression line for the import.
- **Accessibility:** the wizard, classroom pages, report catalog, and
  notification matrix are **keyboard-navigable and screen-reader
  labelled**; the multi-step wizard exposes step state and validation
  errors to assistive tech, and the job tray announces progress and
  completion. Parity includes a11y parity, not just feature parity.

**Neutral / follow-ups**

- A cross-school bulk import (a district admin importing into several
  schools in one pass) is out of scope; the import is single-school.
- Reusing `CsvImportWizard` and the report registry for other resource
  types (staff bulk import, additional report families) is anticipated
  but deferred to their own work items.
- Promoting the persisted-cursor runner to a real queue is a future
  infra decision, not part of this sprint.

## Alternatives Considered

- **BullMQ + Redis for the import job.** The brief's assumption. Rejected
  for this sprint: the repo has no Redis, and adding it for one feature
  imports a stateful dependency to provision, secure, and operate. A
  persisted-cursor runner on `@aivo/scheduling` gives resumability that is
  *stronger* for an idempotent import (database-durable progress) than a
  queue's at-least-once redelivery, which without idempotency would cause
  the exact double-apply we must avoid. We kept the **BullMQ-shaped
  contract** so a real queue can be slotted in later without changing
  callers.
- **Client-only CSV validation.** Validate entirely in the browser and
  trust the upload. Rejected: the server must re-validate regardless (an
  uploaded file is untrusted input), and a browser-only validator would
  drift from the server's rules. Instead the validator is a **shared pure
  package** run on both sides, so the wizard's preview and the server's
  gate are the same code.
- **Giving school admins the full district console.** Hand `school_admin`
  the existing district console and filter the data. Rejected: it leaks
  district-wide affordances (cross-school seat moves, district reports)
  into a single-school role, and "hide what they shouldn't see" is a
  fragile authorization posture. School-scoped routes under the
  school-OR-district-OR-platform rule give the capability without the
  cross-tenant surface.
- **Per-row audit events for the import.** Emit one `audit_events` row per
  imported learner. Rejected: it floods the audit stream and obscures the
  operator's actual intent. One **import summary** event captures who ran
  what against which school; per-learner state lives in the learner
  records themselves.
- **Bespoke endpoint per report.** Hand-write a route for each report.
  Rejected: it duplicates parameter handling, export, and RBAC per report
  and lets the front-end catalog drift from what the backend can run. The
  **registry + parameterized run** keeps one execution path and one source
  of truth for the catalog.
