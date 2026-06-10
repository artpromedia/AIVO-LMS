# Adaptive Learning E2E — Sprint-by-Sprint Implementation Prompts

> Source: production-readiness evaluation (2026-06-10). These prompts close the gaps
> between the platform's core promise (multi-source baseline → grade-level material
> adapted to the learner's level → progression back up to grade level → adult-approved
> improvements) and the current implementation.
>
> **How to use:** paste one prompt per development session, in order. Each prompt is
> self-contained, but Sprints 2–7 assume the previous sprints have merged.

---

## Global rules (prepend to every sprint prompt)

```
GLOBAL CONSTRAINTS — apply to everything you do in this task:

1. NO placeholders, stubs, TODOs, FIXMEs, mock returns, or "implement later" comments.
   Every function you create must be fully implemented and exercised by at least one test.
2. NO silent fallback defaults that mask missing data (the existing `|| "THIRD"` bug is
   the canonical example). If required data is missing, either derive it from a real
   source or fail loudly with a logged, typed error.
3. Production mode is Postgres. Any data a learner or parent must see again MUST be
   written through the persistence adapter / Drizzle into Postgres — never only into
   the in-memory Map store (`apps/web-v2/lib/db/store.ts`, which is a test fixture).
   Every new write needs a memory-adapter implementation AND a Drizzle implementation,
   plus a parity test proving both behave identically (follow the existing pattern in
   `apps/web-v2/lib/db/__tests__/assessments.parity.test.ts`).
4. Every new API route gets: session/role guards consistent with its neighbors, tenant
   scoping, zod (TS) or pydantic (Python) input validation, and route tests.
5. New tables get Drizzle schema + a generated migration in the same PR.
6. Before finishing: run `pnpm turbo lint typecheck test` (and the Python service test
   suites for any ai-svc / brain-svc / curriculum-svc changes) and fix everything you broke.
7. Develop on the designated feature branch; commit with clear messages; do NOT open a PR.
```

---

## Sprint 1 — Persist baseline outputs to Postgres (P0: mastery, learning path, review schedules)

```
CONTEXT
Repo: AIVO-LMS monorepo. The web-v2 baseline pipeline computes a learner's skill
masteries, mastery map, learning path, and review schedules when a baseline assessment
completes — but writes them ONLY to the in-memory Map store, which is empty in
production Postgres mode. The reads are already persistence-routed
(`getMasteryMap` → `getPersistence().curriculum.getMasteryMapForLearner`), so in
production a learner finishes the baseline and the system immediately loses the result:
the parent progress page is empty and next-skill selection has nothing to work with.
The `CurriculumStore` persistence interface has NO mastery write methods at all — the
only writer of the Postgres tables `web_mastery_maps` / `web_skill_masteries` today is
the demo seed script.

Exact breakage sites (verify line numbers before editing; they may have drifted):
- apps/web-v2/lib/db/repos.ts ~1267–1296: idempotent re-read path of baseline
  completion reads `store.masteryMaps` / `store.learningPaths` / `store.skillMasteries`
  / `store.reviewSchedules` directly from the Map store.
- apps/web-v2/lib/db/repos.ts ~1373–1397: the baseline commit block writes
  skillMasteries, masteryMap, learningPath, reviewSchedules into the Map store.
- apps/web-v2/lib/db/repos.ts ~2090–2152: `applyOutcomeToMastery` (called by
  `completeLessonRun`) reads and writes `store.skillMasteries` and `store.masteryMaps`
  directly — every per-lesson mastery update is lost in production.
- apps/web-v2/lib/db/persistence/types.ts ~385–405: `CurriculumStore` interface has
  only `getMasteryMapForLearner`, `getLearningPath`, `replaceLearningPath` for
  per-learner data. No mastery or review-schedule writes.
- packages/db/src/schema/web-domain.ts: `webMasteryMaps` (~182), `webSkillMasteries`
  (~193), `webLearningPaths` (~204) exist. There is NO `webReviewSchedules` table.

TASKS

CREATE
1. `webReviewSchedules` table in packages/db/src/schema/web-domain.ts following the
   exact shape conventions of `webSkillMasteries` (id, learnerId, tenantId, data jsonb,
   appropriate indexes on (learnerId, tenantId)). Generate the Drizzle migration.
2. New methods on the `CurriculumStore` interface in
   apps/web-v2/lib/db/persistence/types.ts:
   - `upsertMasteryMap(map: MasteryMap): Promise<MasteryMap>`
   - `replaceSkillMasteriesForSubjects(learnerId, tenantId, subjectIds: string[],
      rows: SkillMastery[]): Promise<void>` — delete-then-insert semantics matching
      the current commit block (replace ALL prior rows in covered subjects, then insert).
   - `upsertSkillMastery(row: SkillMastery): Promise<SkillMastery>` — keyed on
      (learnerId, tenantId, skillId).
   - `getReviewSchedules(learnerId, tenantId): Promise<ReviewSchedule[]>`
   - `replaceReviewSchedules(learnerId, tenantId, rows: ReviewSchedule[]): Promise<void>`
3. Full implementations of all five methods in BOTH adapters:
   - apps/web-v2/lib/db/persistence/drizzle/curriculum.ts — wrap the multi-table
     baseline write sequence in a single Drizzle transaction.
   - apps/web-v2/lib/db/persistence/memory/curriculum.ts — operate on the Map store
     with identical semantics.
4. Parity tests in apps/web-v2/lib/db/persistence/__tests__/ proving memory and
   Drizzle adapters return identical results for every new method (model on
   assessments.parity.test.ts).

REFACTOR
5. repos.ts baseline completion:
   - The idempotent short-circuit (~1267–1296) must read masteryMap/skillMasteries/
     learningPath/reviewSchedules through `getPersistence().curriculum.*`, not the Map store.
   - The commit block (~1373–1397) must write through the new persistence methods:
     `replaceSkillMasteriesForSubjects`, `upsertMasteryMap`, `replaceLearningPath`
     (already exists), `replaceReviewSchedules`. Remove the direct `store.*` mutations.
6. `applyOutcomeToMastery` (~2090–2152): make it async; read the existing mastery row
   via persistence, apply the existing EWMA scoring math UNCHANGED, write back via
   `upsertSkillMastery`, and bump the mastery map's `updatedAt` via `upsertMasteryMap`.
   Update its caller `completeLessonRun` accordingly.
7. Find every other direct reader of `store.skillMasteries`, `store.masteryMaps`,
   `store.learningPaths`, `store.reviewSchedules` in repos.ts (grep for them) and route
   each through the persistence adapter. After this sprint, zero references to those
   four collections may remain outside lib/db/store.ts itself, the memory adapter, and
   test fixtures.

EDIT
8. apps/web-v2/lib/db/persistence/seed-postgres.ts: keep working against the new
   table set (add webReviewSchedules seeding consistent with the memory seed).

TESTS / ACCEPTANCE (all must pass)
- Integration test (postgres adapter mode): complete a baseline → `getMasteryMap`
  returns the computed rows; simulate a fresh process (new store instance) → rows are
  still returned. This test MUST fail against the current code before your changes.
- Integration test: `completeLessonRun` with a graded outcome → re-read mastery via
  persistence → score moved per the EWMA rule; abandoned run decays toward 0.5.
- Parity tests green for both adapters.
- `pnpm turbo lint typecheck test` green.
```

---

## Sprint 2 — Real grade targeting: populate curriculum alignment, kill the "THIRD" default (P0)

```
CONTEXT
The learner's `curriculum_alignment` JSONB column (on `learners`, `brain_states`,
`lesson_sessions`) is never populated anywhere in the codebase — no code writes a
`grade_band` or `delivery_level` key into it. Enrollment captures zipCode/districtId/
gradeBand onto the learner row (apps/web-v2/app/parent/learners/new/page.tsx) and the
baseline IS correctly grounded against curriculum-svc standards for the learner's real
grade (ai-svc curriculum_client.py), but the resolved alignment is never persisted.
Consequence: services/learning-svc/src/routes/sessions.ts (~457–458 and ~491–492) does
`(brainContext as any).curriculum_alignment?.grade_band || "THIRD"` — every learner,
web and mobile, gets lessons generated for grade THIRD. Same defaulting bug in
services/ai-svc/src/ai_svc/vision/homework_adapter.py (~223). brain-svc's clone
pipeline (clone_pipeline.py ~465–470, 515) faithfully copies the empty `{}` into brain
state.

curriculum-svc already exposes district resolution and standards lookup (used by the
baseline grounding path and by the BFF proxy at
apps/web-v2/app/api/bff/curriculum/lookup) — reuse it; do not duplicate its logic.

TASKS

CREATE
1. A server-side module `resolveCurriculumAlignment` (place it where the learner write
   path lives — find the BFF/server action that inserts the `learners` row for
   apps/web-v2/app/parent/learners/new/page.tsx and put the module alongside that
   layer's service code). It must:
   - Call curriculum-svc district-resolve + lookup with the learner's
     zipCode/country/gradeBand (same endpoints the existing BFF lookup proxy uses).
   - Produce `{ framework, standards, state, districtId, grade_band, delivery_level }`.
   - `grade_band` = enrolled grade (the TARGET). `delivery_level` starts equal to
     grade_band at enrollment and is later overwritten by baseline results (task 4).
   - Persist to `learners.curriculum_alignment`.
   - On curriculum-svc failure: build alignment from the learner's own
     gradeBand/zip with `framework: null` and log a structured warning — the
     grade_band/delivery_level keys must ALWAYS be present after learner creation.
2. A deterministic theta→delivery-level mapping function with unit tests, exported from
   a shared location reachable by both web-v2 and assessment-svc (follow the repo's
   pattern of pure-function packages, e.g. alongside @aivo/scoring):
   - Input: thetaPlacement (logit), enrolled grade_band.
   - Output: per-subject delivery_level expressed as a grade band offset clamped to
     [K, enrolled grade]: theta ≥ 0.4 → on grade; -0.3 ≤ theta < 0.4 → one band below;
     -1.0 ≤ theta < -0.3 → two bands below; theta < -1.0 → three bands below.
   - Document the mapping in the function's doc comment; it is product policy.
3. Backfill script `scripts/backfill-curriculum-alignment.ts`: for every learner with
   empty/missing alignment, run the resolution from task 1; for learners with a
   completed baseline (learner_profiles row or completed web baseline), also apply the
   theta mapping from task 2. Idempotent, batched, dry-run flag, summary output.

EDIT
4. Wire alignment into learner creation AND gradeBand edits: every code path that
   inserts or updates `learners.gradeBand` must (re)run `resolveCurriculumAlignment`.
   Find all such paths (parent learner creation, any settings/edit route) and cover
   each one.
5. Baseline finalization must set delivery_level from results, in BOTH baseline systems:
   - assessment-svc: in the discovery `complete` handler and adaptive `finalize`
     handler (services/assessment-svc/src/routes/learner-baseline.ts and
     learner-profile.ts), after `learner_profiles` is written, update
     `learners.curriculum_alignment.delivery_level` (per subject where per-subject
     estimates exist; otherwise overall) using the task-2 mapping, then ensure the
     brain clone runs AFTER this write so brain_states inherits the populated
     alignment (reorder if needed; clone_pipeline.py already copies the column).
   - web-v2: in the repos.ts baseline commit block (now persistence-routed after
     Sprint 1), apply the same mapping and persist alignment the same way.
6. services/learning-svc/src/routes/sessions.ts (~457–458, ~491–492): remove the
   `|| "THIRD"` literals. New behavior: use `curriculum_alignment.grade_band` /
   `.delivery_level`; if absent, fall back to the learner's `grade_level` column and
   emit a structured WARN log (`event: "curriculum_alignment.missing"`); if that is
   also absent, return a 422 with a typed error — never a silent constant.
7. services/ai-svc/src/ai_svc/vision/homework_adapter.py (~223): same treatment —
   brain_context grade_band, else learner grade_level passed in context, else explicit
   error path. No "THIRD" literal remains anywhere except tests.

TESTS / ACCEPTANCE
- grep for `"THIRD"` across services/ and apps/: no production-code fallback remains.
- Unit tests for the theta→delivery-level mapping (all bands + clamping).
- Integration: create learner (ZIP with seeded district, e.g. Tacoma 98402, grade 5) →
  learners.curriculum_alignment has framework + grade_band "5" + delivery_level "5".
- Integration: finalize a baseline with theta ≈ -0.5 → delivery_level drops two bands;
  brain_states latest row carries the populated alignment; learning-svc session
  generation request payload contains gradeTarget "5" and the computed deliveryLevel
  (assert on the captured ai-svc request body, mock only the LLM call itself).
- Backfill dry-run executes against seeded data and reports correct counts.
- `pnpm turbo lint typecheck test` + ai-svc/learning-svc test suites green.
```

---

## Sprint 3 — Prerequisite-aware learning paths + mastery trajectory (progression, part 1)

```
CONTEXT
Next-skill selection ignores the skill graph: apps/web-v2/lib/db/repos.ts
(getSubjectDetail, ~1610–1615) picks "lowest-scoring skill below 0.65", and
generateLearningPath orders by score alone. The @aivo/skill-graphs package
(packages/skill-graphs/src/graph.ts) ships validated `topologicalSort`,
`prerequisiteClosure`, and `validateGraph` with seeded CCSS/NGSS graphs, but has ZERO
runtime callers (tutor-svc imports only a type). Web skills already carry a
`prerequisites` field (see upsertSkill / skill patch handling in repos.ts ~3958).
There is also no historical record of mastery — parents cannot see "was at X, now at
Y, Z to go" — and `regenerateLearningPath` (repos.ts ~1545) has two BFF routes
(`progress/recalculate`, `learning-path/generate`) that no UI calls.

Sprints 1–2 are merged: mastery persists via the CurriculumStore adapter and
curriculum_alignment.grade_band/delivery_level are populated.

TASKS

CREATE
1. `webMasterySnapshots` table (packages/db/src/schema/web-domain.ts + migration):
   id, learnerId, tenantId, subjectId, capturedAt, data jsonb
   { averageScore, level, skillsOnGradeLevel, skillsTotal, deliveryLevel, gradeBand,
     trigger: "baseline" | "lesson" | "scheduled" }. Index (learnerId, tenantId,
     subjectId, capturedAt).
2. Persistence methods (both adapters + parity tests, per Sprint 1 conventions):
   `appendMasterySnapshot(row)`, `listMasterySnapshots(learnerId, tenantId,
   subjectId?, sinceIso?)`.
3. A pure module `selectNextSkills` in apps/web-v2/lib/learner/ that consumes the
   learner's skills + masteries and returns the ordered unlocked frontier:
   - Build the prerequisite graph from the webSkills `prerequisites` edges and run it
     through @aivo/skill-graphs `validateGraph` (log + skip malformed edges rather
     than crash) and `topologicalSort`.
   - A skill is UNLOCKED when every prerequisite has mastery score ≥ 0.65.
   - Order: unlocked, not-yet-mastered skills first, topologically sorted, tie-broken
     by (a) proximity to the learner's delivery_level grade band ascending toward
     grade_band, then (b) lowest score.
   - Full unit-test suite: chains, diamonds, cycles (must not infinite-loop — rely on
     validateGraph cycle detection), empty-prereq skills, fully-mastered subject.
4. Trajectory UI on the parent progress page
   (apps/web-v2/app/parent/learners/[learnerId]/progress/page.tsx):
   - Per-subject sparkline/chart of mastery snapshots over time (use the repo's
     existing chart approach in web-v2; if none exists, render an accessible inline
     SVG — no new chart dependency without checking the existing dashboards first).
   - "Distance to grade level" indicator per subject: gradeBand vs current
     deliveryLevel plus skillsOnGradeLevel/skillsTotal.
   - A "Refresh learning path" button wired to the EXISTING BFF route
     /api/bff/learners/[learnerId]/learning-path/generate, with optimistic UI and
     the same guards as sibling actions.

REFACTOR
5. getSubjectDetail next-skill logic (~1610–1615) and generateLearningPath must both
   delegate to `selectNextSkills`. Remove the lowest-score-only sort.
6. `completeLessonRun`: after `applyOutcomeToMastery`, when a skill's level changed,
   call `regenerateLearningPath` for that learner and append a mastery snapshot
   (trigger "lesson"). Keep this in the same request path but resilient — a snapshot
   failure must not fail the lesson completion (log + continue).
7. Baseline commit block: append initial snapshots per covered subject
   (trigger "baseline").

TESTS / ACCEPTANCE
- Unit: selectNextSkills never returns a locked skill; topological order respected;
  a learner mastering a prerequisite unlocks its dependents on the next call.
- Integration: complete baseline → snapshots exist per subject; complete two lesson
  runs that raise a skill level → a new snapshot row appears and the learning path's
  node order changes accordingly.
- UI: progress page renders trajectory + gap indicators from seeded snapshots
  (component test or existing page-test pattern).
- `pnpm turbo lint typecheck test` green.
```

---

## Sprint 4 — Upward progression + re-baselining loop (progression, part 2)

```
CONTEXT
The system only ever adapts DOWNWARD. recommendation-svc's generator
(services/recommendation-svc/src/services/recommendation-generator.ts) has a
delivery_level_change candidate that lowers level on struggle (~67–97) but nothing
raises it on sustained mastery; its mastery_adjustment candidate can never fire because
no service ever emits a `mastery_signal`; `rebaseline_request` exists as a type and a
no-op effect handler but is never generated, and family-svc sets
`rebaselinePending = true` (services/family-svc/src/routes/recommendation-effects.ts
~325–337) with zero consumers. The adaptive baseline engine already supports a prior
theta (apps/web-v2/lib/learner/baseline-adaptive.ts priorTheta seeding), so
re-baselining can start from the current estimate.

Recommendation effect handlers
(services/recommendation-svc/src/services/recommendation-effect-handlers.ts) mutate an
in-memory BrainProfile and snapshot it — VERIFY whether the mutated profile is persisted
to brain_states and to learners.curriculum_alignment; if not, that persistence is part
of this sprint (a recommendation that "applies" without persisting is a stub by this
project's standards).

Sprints 1–3 are merged: mastery + snapshots persist; alignment populated; prerequisite
frontier drives selection.

TASKS

CREATE
1. Mastery signal emission: when web-v2 `completeLessonRun` updates mastery, emit a
   recommendation signal `{ source: "lesson", metric: "mastery_signal", value:
   afterScore, metadata: { skillId, subjectId, levelBefore, levelAfter } }` to
   recommendation-svc, following the existing fire-and-forget pattern in
   services/problem-session-svc/src/services/recommendation-signal-emitter.ts
   (~100–126). Also emit from learning-svc session completion (sessions.ts gradebook
   write site, ~607–647) so both lesson pipelines feed the same loop.
2. Two new candidate rules in recommendation-generator.ts, with the same evidence-
   sufficiency gating as existing rules:
   - UPWARD delivery_level_change: ≥3 distinct skills in a subject sustained at
     level ≥ on_grade_level (score ≥ 0.65 with confidence ≥ 0.6) AND current
     delivery_level below grade_band → propose raising delivery_level one band toward
     grade_band. proposedValue carries { subjectId, from, to }. requiresParentApproval
     = true; reversible = true.
   - rebaseline_request: fire when (a) the newest learner_profiles.baselineCompletedAt
     (or web baseline completedAt) is older than 90 days, OR (b) mastery_signal
     evidence shows ≥5 skills changed level since the last baseline, OR (c) stall —
     ≥10 lesson mastery_signals in a subject with average score movement < 0.05.
3. Re-baseline apply path (the missing consumer): when a rebaseline_request is
   APPROVED, the apply step must create a real new baseline run, seeded with prior
   theta = current thetaPlacement from learner_profiles:
   - recommendation-svc calls assessment-svc (or the web-v2 BFF createBaseline path —
     pick the one the learner UI actually runs, i.e. the web-v2 baseline creation used
     by /parent/learners/[learnerId]/baseline, and thread priorTheta through
     `createBaseline` → baseline-adaptive priorTheta seeding).
   - Surface the new baseline on the learner home the same way a first baseline
     appears (it must be startable by the learner without manual steps).
   - Remove or repurpose the dead `rebaselinePending` flag writes in family-svc so
     there is exactly ONE re-baseline mechanism after this sprint.
4. Persistence for applied recommendations (pending the verification above): an
   APPLIED delivery_level_change must write the new delivery_level into
   learners.curriculum_alignment AND the latest brain_states row (the same fields
   learning-svc reads), inside the apply transaction with the snapshot.

EDIT
5. Ensure the recommendation effect handler for the upward delivery_level_change
   reuses the existing delivery_level_change handler path (extend, don't fork).

TESTS / ACCEPTANCE
- Unit: both new candidate rules (fire / don't-fire matrices across the threshold
  boundaries); signal emitter payload shape.
- Integration: simulate 3 skills crossing on_grade_level → PENDING upward
  recommendation exists; approve it as parent → learners.curriculum_alignment
  delivery_level raised one band, brain_states updated, snapshot recorded, audit
  event emitted; learning-svc session generation now sends the raised deliveryLevel.
- Integration: approve a rebaseline_request → a new startable baseline exists for the
  learner, seeded with prior theta (assert the first served item difficulty reflects
  the prior, not 0).
- Declined recommendations apply nothing (regression test).
- `pnpm turbo lint typecheck test` green.
```

---

## Sprint 5 — Recommendation visibility: parent UI, notifications, single source of truth

```
CONTEXT
The recommend→approve→apply backend is complete (recommendation-svc: candidates,
parent-only policy, accept/amend/decline with snapshots + audit), but it is invisible:
no web-v2 or mobile UI lists pending recommendations or calls the decision endpoints,
comms-svc has zero recommendation handlers (no email/push when one is created), and
the whole v2 flow hides behind AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2 (default off)
with a parallel legacy flow in family-svc (`brain_recommendations` +
/api/family/recommendations/... + recommendation-effects.ts).

Decision endpoints: POST /api/recommendations/:id/{accept,amend,decline}
(services/recommendation-svc/src/routes/recommendations.ts ~51–201). Listing route:
check services/recommendation-svc/src/routes/ for an existing list-by-learner route;
if none exists, create GET /api/recommendations/learner/:learnerId?status=PENDING
with tenant + role guards.

TASKS

CREATE
1. BFF layer in web-v2 (follow the guard/response conventions of sibling BFF routes,
   e.g. apps/web-v2/app/api/bff/learners/[learnerId]/baseline/route.ts):
   - GET /api/bff/learners/[learnerId]/recommendations → proxies the list route;
     returns pending + recent decided, with evidence summaries.
   - POST /api/bff/learners/[learnerId]/recommendations/[recId]/respond
     { action: "accept" | "amend" | "decline", amendedValue?, declineReason? } →
     proxies the matching decision endpoint. Parent role required (requireRole +
     requireLearnerScope + consent guard, same as neighbors).
2. `PendingRecommendationsPanel` component on the parent learner page
   (apps/web-v2/app/parent/learners/[learnerId]/page.tsx), using the design system
   already used by WhatsWorkingPanel on that page:
   - Each card: human-readable title per recommendation type, evidence summary
     ("based on 4 lesson signals + 1 teacher observation"), proposed change
     (from → to), Approve / Adjust / Decline actions; Adjust opens the amend input;
     Decline requires a reason.
   - Empty state and error state. Full loading/optimistic handling.
   - Decision results render the applied/declined state inline (no page reload).
3. Pending-count badge in the parent navigation (packages/nav or wherever the parent
   nav lives — find WhatsWorkingPanel's nav integration and mirror it).
4. comms-svc notification handler: on recommendation creation (consume the same bus
   the RECOMMENDATION_SUGGESTED event uses — extend the event payload or add a
   RECOMMENDATION_PENDING event emitted by recommendation-svc persistence), send the
   learner's guardians an email + push using comms-svc's existing template/delivery
   machinery, deep-linking to /parent/learners/[learnerId] with the panel anchored.
   Include digest suppression: max one notification per learner per 24h, additional
   pending recs fold into the existing notification copy.
5. Mobile: a recommendations screen in apps/mobile (list + approve/amend/decline)
   calling the same BFF routes, following the existing pattern in
   apps/mobile/src/api/ (e.g. baselineClient.ts / sessionClient.ts).

EDIT / DELETE
6. Flag and legacy consolidation:
   - Default AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2 to ON in env schema + envs.
   - Make family-svc's legacy routes (/api/family/recommendations/... and
     recommendation-effects.ts apply path) delegate to recommendation-svc v2 (they
     already have a mirror pathway — make v2 the system of record, with the legacy
     `brain_recommendations` write retained only as a back-compat mirror, clearly
     marked, with a test asserting v2 and mirror never diverge on status).
   - DELETE any legacy code path that would let an effect apply WITHOUT a v2 record
     after this change.

TESTS / ACCEPTANCE
- Route tests: non-parent roles get 403 on respond; tenant isolation enforced.
- Component/page test: panel renders pending recs from a mocked BFF response; approve
  flow fires the POST and re-renders as applied.
- Integration: create a PENDING rec → comms-svc handler produces exactly one
  notification (and suppresses a second within 24h) → parent approves via BFF →
  recommendation-svc status APPLIED, effect persisted (per Sprint 4), audit emitted.
- `pnpm turbo lint typecheck test` green.
```

---

## Sprint 6 — Therapist intake + caregiver observations into the baseline

```
CONTEXT
The platform promises baseline construction from parents + optional IEP + teachers +
caregivers + THERAPISTS. Today: parent assessment, IEP parsing, teacher assessment,
and multi-caregiver perspectives all flow into the baseline prompt
(services/assessment-svc/src/routes/learner-baseline.ts loads each and
services/ai-svc/src/ai_svc/services/baseline_generator.py renders dedicated prompt
blocks). Two inputs do NOT:
- Therapists: role exists, collaboration link (learnerTherapists) + therapyGoals +
  therapySessions tables exist (packages/db/src/schema/collaboration.ts ~56–119),
  but there is NO therapist assessment route, no loadTherapistContext() in
  learner-baseline.ts (it imports learnerTherapists only for access checks), and no
  therapist block in the generator prompts.
- Caregiver observation notes (caregiverObservations, family-svc
  routes/observations.ts) feed recommendation-svc signals but never the baseline.

Mirror the teacher pathway exactly — it is the clean template:
services/assessment-svc/src/routes/teacher-assessment.ts (route + authz),
packages/db/src/schema/assessments.ts teacherAssessments (~80–108),
loadTeacherContext() (learner-baseline.ts ~288–310),
_format_teacher_block() (baseline_generator.py ~148–200).

TASKS

CREATE
1. `therapistAssessments` table in packages/db/src/schema/assessments.ts, modeled on
   teacherAssessments: learnerId, submittedByUserId, tenantId, therapyDiscipline
   (speech | occupational | behavioral | physical | other), areasOfFocus[],
   strengths[], challenges[], sensoryNotes, communicationNotes, regulationStrategies[],
   recommendedAccommodations[], observations text, additionalResponses jsonb, status,
   timestamps. Migration included.
2. Route file services/assessment-svc/src/routes/therapist-assessment.ts:
   - POST /api/assessments/therapist — authz: THERAPIST with an ACCEPTED
     learnerTherapists link to the learner (mirror the teacher route's accepted-link
     check), plus SPED_LEAD / PLATFORM_ADMIN.
   - GET /api/assessments/therapist/:learnerId/status — mirrors the teacher status route.
   - Register it where the other assessment routes are registered.
3. `loadTherapistContext()` in learner-baseline.ts: most recent completed therapist
   assessment per submitter (multiple therapists may exist — return an array like
   caregiver perspectives), PLUS active therapyGoals rows (title, baseline, target,
   discipline) so existing therapist-authored goals reach the prompt even before a
   formal assessment is submitted. Wire it into the baseline payload
   (`therapist_assessments`, `therapy_goals`) at the payload build site (~969–987),
   for BOTH the discovery-chapter and generate-baseline calls.
4. `_format_therapist_block()` in baseline_generator.py rendering discipline, focus
   areas, strengths/challenges, regulation strategies, accommodations, observations,
   and active therapy goals ("target these domains explicitly", matching the IEP
   block's tone). Render it in both the discovery and baseline prompt builders, right
   after the teacher block. Handle the multi-therapist array case (one sub-block per
   discipline).
5. Therapist-facing form in web-v2: an assessment page for the therapist role
   mirroring the parent assessment wizard structure
   (apps/web-v2/app/parent/learners/[learnerId]/assessment/page.tsx) at the
   equivalent therapist route, submitting to the new endpoint through a new BFF route
   with therapist-role guards. Check how teacher-role pages resolve learner scope and
   reuse that pattern.

EDIT
6. Caregiver observations into the baseline: in learner-baseline.ts, load the most
   recent 20 caregiverObservations (category, mood, notes truncated to a safe length,
   date) and pass as `caregiver_observations`; add a compact
   `_format_caregiver_observations_block()` to baseline_generator.py (distinct from
   the perspectives block) that frames them as recent real-world context, not
   assessment data.
7. Update the baseline status/readiness endpoints (the ones the parent baseline page
   polls) to report therapist-assessment presence as an OPTIONAL enrichment (like
   teacher), never a blocker.

TESTS / ACCEPTANCE
- Route tests: therapist with accepted link can submit; therapist without link gets
  403; parent cannot submit a therapist assessment.
- learner-baseline payload test: with seeded therapist assessment + 2 therapy goals +
  3 observations, the JSON sent to ai-svc contains all three new fields (assert on
  captured request body).
- Python tests for both new prompt blocks (presence, multi-discipline rendering,
  truncation, absence → empty string, matching the existing block tests' style).
- Web form test: therapist completes the wizard → row persisted with status complete.
- `pnpm turbo lint typecheck test` + ai-svc pytest green.
```

---

## Sprint 7 — Hardening: one mastery store, ADR-0041 compliance, recalibration schedule, full-journey E2E test

```
CONTEXT
Remaining production-readiness items after Sprints 1–6:
(a) Two lesson pipelines write learning evidence to different places: web-v2
    lesson-runs update webSkillMasteries (Sprint 1), while learning-svc session
    completion (services/learning-svc/src/routes/sessions.ts ~607–647) writes only
    gradebookEntries — its evidence never reaches the mastery store that drives
    selection, paths, snapshots, and recommendations.
(b) brain-svc's POST /:learnerId/pull-standards
    (services/brain-svc/src/brain_svc/routes/curriculum.py ~37–120) asks the LLM to
    "extract" curriculum standards, violating ADR 0041 (LLMs never emit authoritative
    standards; curriculum-svc is the sole source — see docs/adr/0040 and 0041).
(c) The baseline item-recalibration job has telemetry capture + job code
    (apps/web-v2/lib/jobs/recalibrate-baseline*, webBaselineTelemetry) but no
    scheduled invocation anywhere.
(d) No automated test exercises the core promise end-to-end; every break found in the
    production-readiness review would have been caught by one.

TASKS

REFACTOR
1. Single mastery write path: when learning-svc completes a session, it must also
   update the learner's skill mastery in the same store web-v2 uses.
   - Map the session's skill/standard to the webSkills id space (they share skill
     identifiers via the seeded curriculum; verify and document the join, and if a
     mapping table is genuinely required, create it with a migration — do not guess).
   - Reuse the EWMA function: extract `applyOutcomeToMastery`'s pure scoring math from
     repos.ts into a shared workspace package (e.g. packages/scoring), with web-v2 and
     learning-svc both consuming it. Identical math, one source of truth, unit tests
     move with it.
   - learning-svc writes via direct Drizzle access to webSkillMasteries/webMasteryMaps
     (it already uses @aivo/db) inside its completion transaction, and emits the
     Sprint-4 mastery_signal as before. Gradebook entries remain (they serve teacher
     reporting) but are no longer the dead end.
2. brain-svc pull-standards: replace the LLM extraction call with an HTTP query to
   curriculum-svc's lookup (the catalogue is the authority; ai-svc's
   curriculum_client.py shows the integration pattern). The LLM may still SCAFFOLD
   (sequence/rephrase) the returned nodes, but every standard code in the response and
   in the persisted pulled_standards must exist in the curriculum-svc response —
   reject and log anything else (reuse curriculum_validator.py). Update that route's
   tests accordingly.

CREATE
3. Recalibration schedule: a runnable entrypoint script for the recalibration job
   (scripts/ or apps/web-v2 job runner — wherever the job code lives, give it a CLI
   entry) plus a scheduled invocation consistent with how this repo runs other
   recurring ops (inspect ops/, infra/, .github/workflows for the existing pattern —
   cron workflow, k8s CronJob manifest, or similar — and add this job there; weekly).
   The job must: read webBaselineTelemetry since last run, recompute item difficulty/
   discrimination per the existing recalibrate-baseline logic, persist updated
   calibration where getBaselineCalibrationMap reads it, and write a structured
   run-summary log. Include a test running the job against seeded telemetry and
   asserting calibration movement.
4. Full-journey E2E test (Playwright if e2e infra exists — check docker-compose.e2e.yml
   and e2e/ for the harness; otherwise a service-level integration test that exercises
   real HTTP routes against Postgres — NOT the memory adapter; LLM calls mocked at the
   HTTP boundary with realistic fixture responses, nothing else mocked):
   Journey, asserting after every step:
   a. Parent creates learner (grade 5, seeded district ZIP) → curriculum_alignment
      populated with grade_band "5".
   b. Parent submits parent assessment; uploads IEP fixture → iep_profiles + iep_goals
      rows exist.
   c. Teacher submits teacher assessment; therapist submits therapist assessment.
   d. Baseline payload sent to ai-svc contains parent/IEP/teacher/therapist/
      observation context (assert captured request).
   e. Learner completes the baseline (drive the adaptive loop with scripted answers
      producing theta ≈ -0.5) → learner_profiles + mastery + path + snapshots
      persisted in Postgres; delivery_level lowered per mapping.
   f. Learner starts a lesson → generation request carries gradeTarget "5" and the
      lowered deliveryLevel (grade-level material, learner's level).
   g. Complete lessons with strong outcomes until ≥3 skills cross on_grade_level →
      PENDING upward delivery_level_change recommendation exists; notification
      recorded.
   h. Parent approves via the BFF respond route → alignment + brain state raised one
      band; audit event exists; next lesson request carries the raised level.
   i. Approve a rebaseline_request → a new baseline seeded with prior theta is
      startable.
   Wire this test into CI as a required job (follow the repo's existing CI workflow
   structure).

TESTS / ACCEPTANCE
- learning-svc session completion measurably moves webSkillMasteries (integration test).
- pull-standards returns only catalogue-verified codes; a test feeding a hallucinated
  code through the scaffold path proves rejection.
- Recalibration job runs from its CLI entry against seeded telemetry.
- The full-journey test passes in CI and fails if any single seam in steps a–i is
  reverted (spot-check by temporarily reverting the Sprint 2 sessions.ts change and
  observing the failure, then restoring).
- `pnpm turbo lint typecheck test` + all Python suites green.
```

---

## Sequencing and dependency notes (for the reviewer, not part of the prompts)

| Sprint | Depends on | Risk level | Rough scope |
|---|---|---|---|
| 1 — Persist baseline outputs | — | Low (wiring, schemas exist) | days |
| 2 — Grade targeting | 1 (delivery_level write site) | Medium (cross-service) | days–1 wk |
| 3 — Prereq paths + trajectory | 1, 2 | Medium | 1 wk |
| 4 — Upward progression + re-baseline | 1–3 | Medium-high (new product policy) | 1–2 wks |
| 5 — Recommendation visibility | 4 (upward recs to display) | Medium (UI + comms) | 1 wk |
| 6 — Therapist + observations intake | — (parallelizable after 1) | Low (template exists) | days–1 wk |
| 7 — Hardening + E2E | all | Medium | 1 wk |

Sprint 6 has no dependency on 2–5 and can run in parallel with any of them.
Sprints 1 and 2 are the launch blockers; everything else is sequenced to make the
promise true, then provable (Sprint 7's journey test is the regression canary for the
entire chain).
