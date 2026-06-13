# 0042 — One brain, one gate: a shared approval/consent contract across every lesson pipeline

- **Status:** Accepted
- **Date:** 2026-06-13
- **Deciders:** @ofemekapongofem (owner; D3 pre-decided — option (a))
- **Related:** [ADR 0007](./0007-web-v2-persistence-migration.md) (persistence
  adapter), [ADR 0009 — service-stack parity](./0009-service-stack-parity-rollout.md)
  (the `lib/services/brain-svc.ts` bridge), [ADR 0032](./0032-audit-architecture.md)
  (audit hash chain), [ADR 0036](./0036-responsible-ai-controls.md) (RAI).
  Sprints C-01 (web teach gate), C-02 (scoped reads), C-06 (approval record +
  revision + audit events). Consumed by C-13 (re-approval thresholds).

## Context

AIVO runs two brain pipelines that each answer the product's central
question — *"is this child's profile approved, by whom, under which
consent?"* — and they answer it **differently**:

- **web-v2** keeps approval in `LearnerBrainProfile.cloneStage` /
  `approvalStatus` (`apps/web-v2/lib/db/types.ts`). After **C-01** the lesson
  pipeline gates on it: `createLessonRun` refuses with a typed
  `brain_not_approved` unless `cloneStage === "approved"`
  (`apps/web-v2/lib/db/repos.ts`). After **C-06** a dedicated, append-only
  `brain_profile_approvals` record (migration 0108) carries the actor, action,
  consent version, RAI version, the reviewed profile revision, folded
  modifications, and a hashed request IP.
- **brain-svc** keeps approval in `brain_states.approval_status`
  (`pending_parent_review | approved | amended | declined`). `/approve`
  enforces COPPA consent + RAI acknowledgement and persists them in the
  `xai_explanation` JSONB (`services/brain-svc/src/brain_svc/routes/brain.py`).
  Crucially, learning paths are initialised **only inside the approve/amend
  handlers** — the Python gate is *implicit by sequencing*. A repo-wide grep
  confirms `approval_status` is referenced by **no other service**:
  `learning-svc`'s path-init route
  (`/api/learning/path/:learnerId/:subject/init`, internal-token protected,
  `services/learning-svc/src/routes/sessions.ts`) and `tutor-svc` never
  re-check it. Any *other* caller of path-init (a retry, a future scheduler,
  an internal-token integration) would initialise a learning path for an
  **unapproved** child, and nothing at teach time would stop it.
- **Consent** is modelled three ways: web-v2 has the real under-13 regime
  (`lib/bff/consent-guard.ts`, typed `ConsentRecord` + `CONSENT_TYPES`, age
  gates); family-svc has a thinner generic `consent_records` table
  (string-typed `consent_type`, version frozen to `"1.0"` —
  `services/family-svc/src/routes/consent.ts`); brain-svc buries consent in
  `xai_explanation` JSONB.
- **FERPA:** role-scoped *reads* exist (family-svc teacher/caregiver/therapist
  brain views, `services/family-svc/src/routes/collaboration.ts`; brain-svc
  scoped reads post-C-02), but **no disclosure log** records *who read which
  child's data, when, in what role, on which surface*. Verified absent in both
  stacks. (web-v2 has a `DisclosureLog` type, but it models third-party FERPA
  *disclosures* — auditor/law-enforcement recipients — not internal cross-role
  reads.)

Two stacks disagreeing about the product's central promise is the report's
central architectural finding. This ADR closes it.

## Decision

**D3 = option (a) (pre-decided by the owner).** web-v2's store remains the
**runtime source of truth for the live learner surface**. The
**approval/consent contract** — the status enum, the record shape, and the
revision semantics from C-06 — becomes **shared**, and brain-svc adopts the
same statuses and record fields. We do **not** put a network hop on the live
lesson path (that is option (b), rejected below), and we do **not** retire a
pipeline in this sprint (option (c), costed below).

Concretely:

1. **Shared approval contract (one definition, two language bindings).**
   The canonical record shape is C-06's `brain_profile_approvals`
   (`packages/db/src/schema/brain-profile-approvals.ts` +
   `apps/web-v2/lib/db/types.ts: BrainProfileApproval`). We add a small,
   dependency-free contract module that both stacks validate against:
   - **TypeScript:** `packages/db/src/schema/approval-contract.ts` exports the
     status enum (`BRAIN_APPROVAL_STATUSES`), the *teaching* sub-set
     (`TEACHING_APPROVAL_STATUSES = ["approved", "amended"]`), the approval
     *action* enum (`APPROVAL_RECORD_ACTIONS`), the canonical record field list,
     a `canTeach(status)` predicate, and a `parseApprovalRecord(...)` validator.
   - **Python:** `services/brain-svc/src/brain_svc/contracts/approval_contract.py`
     mirrors it: a pydantic `BrainProfileApprovalRecord`, the same
     `BRAIN_APPROVAL_STATUSES` / `TEACHING_APPROVAL_STATUSES` /
     `APPROVAL_RECORD_ACTIONS` constants, and a `can_teach(status)` predicate.
   - There is **no shared codegen across TS↔Python** in this repo, so parity is
     held by **mirrored constants + a parity test on each side** (TS:
     `apps/web-v2/lib/db/__tests__/approval-contract.parity.test.ts`; Python:
     `services/brain-svc/tests/test_approval_contract_parity.py`). The two
     parity tests assert the *same literal sets*; a drift on either side fails
     CI. This document is the human-readable parity record.

2. **brain-svc writes the shared-shape record.** The approve/amend handlers
   build a `BrainProfileApprovalRecord` (via the contract module) **in addition
   to** the C-06 audit events they already emit, and validate it before
   responding. Historical consent buried in `xai_explanation` stays *readable*;
   no destructive migration. (Per scope, retroactive migration of historical
   JSONB beyond readability is out of scope.) brain-svc's `approval_status`
   values are unchanged — they already *are* the shared enum
   (`packages/db/src/schema/enums.ts: brainApprovalStatusEnum`).

3. **Explicit services-side gate.** The implicit "init-only-inside-approve"
   sequencing is replaced by an **explicit** `approval_status ∈ {approved,
   amended}` check at the lesson/path entry point, enforced **regardless of
   caller** (internal-token included):
   - **learning-svc** is where the gap lives, so the gate lives there. It
     already shares the database with brain-svc (both read `@aivo/db`'s
     `brain_states` off the same `DATABASE_URL`), so the path-init handler
     (`sessions.ts`) now reads `brain_states.approval_status` for the learner
     and refuses with **403 `brain_not_approved`** unless the status can teach.
     The check runs *after* `requireLearnerAccess` and applies to every caller,
     including `x-service-token` internal callers (brain-svc's own
     approve/amend init calls pass it, because by then the status is
     approved/amended).
   - **brain-svc** gains a reusable `assert_can_teach(status)` guard (from the
     contract module) so the Python side's intent is explicit and unit-tested,
     not merely sequencing.
   - The teaching set is `{approved, amended}` (an amendment is an accepted
     profile with parent overrides — it teaches). This matches web-v2, where
     `approveBrainClone` sets `cloneStage === "approved"` for both a plain
     approve and an amend.

4. **Consent-model unification.** web-v2's **typed** consent regime
   (`CONSENT_TYPES`, versioned `ConsentRecord`, age gates) is the **standard**.
   family-svc's generic `consent_records` table is **mapped, not rebuilt**: its
   free-form `consent_type` strings are a superset key space, and its frozen
   `"1.0"` version is treated as the legacy default. We do **not** migrate or
   deprecate the family-svc route in this sprint (it is the mobile/web consent
   center's write path and C-13/D1 depend on its stability); we record here
   that the **typed regime is canonical** and that any *new* consent surface
   must adopt `CONSENT_TYPES` + explicit versions. The approval record's
   `consent_version` / `rai_version` fields are the cross-stack consent
   anchor — both stacks already populate them (web-v2 `performBrainApproval`,
   brain-svc `/approve`).

5. **FERPA disclosure log (cross-role reads).** A disclosure is recorded
   whenever a profile is **read across a role boundary** — the tuple is
   `(tenantId, learnerId, readerUserId, readerRole, surface/route, dataClass,
   timestamp)`. We **extend existing audit infrastructure** rather than build a
   parallel store (the sprint's stated preference), with a dedicated, queryable
   event type:
   - **Services side (the genuine cross-role reads):** family-svc's
     teacher/caregiver/therapist brain views
     (`collaboration.ts`) and brain-svc's scoped reads (post-C-02) emit a
     **`CHILD_PROFILE_DISCLOSED`** event. family-svc writes it to the
     hash-chained, append-only `audit_events` table (shared via `@aivo/db`,
     ADR 0032 chain), carrying `readerRole`/`surface`/`dataClass` in `details`
     and `learnerId` on the row. brain-svc emits the same event type to
     audit-svc via its existing `emit_brain_audit` client when a **non-parent**
     role reads.
   - **Query surface:** a compliance/admin read endpoint on family-svc —
     `GET /api/family/compliance/disclosures/:learnerId?from=&to=` — restricted
     to `PLATFORM_ADMIN` / compliance roles, returning that learner's
     `CHILD_PROFILE_DISCLOSED` rows within the time window. (Minimal UI is not
     required; endpoint + tests are.)
   - **Web-v2 BFF brain-profile read:** this route is *parent-reading-own-child*
     (least-privilege, parent-only — C-02), so it is not a cross-role read, but
     the sprint lists it as a write surface. web-v2 records it in a dedicated
     **`child_profile_disclosures`** access-log table that mirrors the existing
     `IEPDocumentAccessLog` per-learner access-log pattern already in the
     compliance store (`appendChildProfileDisclosure` /
     `listChildProfileDisclosuresForLearner`, memory + drizzle + migration
     0114), with its own per-learner query. We keep web reads in web-v2's own
     DB (its persistence boundary) rather than reaching into the services'
     `audit_events`; both surfaces use the **same event semantics and the same
     tuple**, documented here. This is the honest two-surface reality of a
     two-database product; the cross-role enforcement that FERPA cares about
     (a teacher/therapist reading another family's child) lives entirely in the
     services-side `audit_events` surface and its query endpoint.

   **Why `audit_events` and not a brand-new table for the services side:** it
   already gives us append-only enforcement + a tamper-evident hash chain
   (ADR 0032), it is already shared by every Node service via `@aivo/db`, and
   family-svc already emits to it (`emitFamilyAudit`). A parallel store would
   re-implement the chain, the append-only triggers, and the tenant scoping for
   no benefit. `audit_events` carries `learner_id`/`event_type`/`details`
   columns, so "every `CHILD_PROFILE_DISCLOSED` for learner L in window
   [from,to]" is a first-class indexed query.

## Consequences

- **Positive:**
  - One definition of "approved" — the same status enum and the same teaching
    set (`{approved, amended}`), validated by a parity test on each side.
  - The services lesson path is gated **explicitly and server-side**, proven by
    a test that runs against **both** pipelines (web `createLessonRun` and
    learning-svc path-init). The Python gate is no longer sequencing-only.
  - A cross-role read of a child's profile now produces a tamper-evident
    disclosure row, queryable per-learner and time-bounded by a
    compliance-scoped endpoint. FERPA's "who saw what, when" is answerable.
  - The live lesson path takes **no new network dependency** (the cost of
    option (b) is avoided): the gate is a local DB read in learning-svc against
    the shared `brain_states` table.
  - Nothing destroys learner work: the gate *refuses*, the disclosure log is
    *append-only*, decline still *archives* (C-06).
- **Negative / accepted risk:**
  - **Two databases, two disclosure surfaces.** web-v2 logs its own BFF reads
    in its DB; the services log cross-role reads in `audit_events`. A single
    pane of glass over *both* would require a federated query (a reporting-layer
    concern, not this sprint). Mitigated: the genuinely sensitive cross-role
    reads are all on the services surface with one query endpoint.
  - **Parity is held by mirrored constants, not codegen.** A determined drift
    that changes *both* parity tests in lockstep-but-wrong is possible. Accepted:
    the same risk every cross-language contract in this repo carries; the parity
    tests + this ADR are the guard.
  - **family-svc consent stays generic** for now. The typed regime is declared
    canonical but the family-svc table is only *mapped*, not migrated. C-13/D1
    inherit a still-thin family-svc consent surface.
- **Neutral / follow-ups:**
  - C-13 (re-approval thresholds, parent change-notifications) consumes this
    contract and the revision semantics. **Now landed**: C-13 adds a sibling
    *change contract* (`packages/db/src/schema/change-contract.ts` ↔
    `services/brain-svc/src/brain_svc/contracts/change_contract.py`, parity-tested
    on both sides like the approval contract) defining the `brain_profile_changes`
    record shape, the `mastery | structural` kinds, and the invariant
    `requiresAck ⇔ structural`. A structural change (functioning level,
    accommodations, tutor activation, IEP-derived shift) sets `requiresAck` on the
    DELTA and notifies the parent; mastery changes flow freely. The
    acknowledgement window is **14 days** (`BRAIN_CHANGE_ACK_WINDOW_DAYS`),
    **non-blocking** — it never revokes teaching (the C-01/D-gate predicate is
    unaffected); on lapse the un-acked delta escalates from one 7-day digest
    reminder (`BRAIN_CHANGE_REMINDER_AFTER_DAYS`) to a persistent in-app badge.
    Change records anchor to the same `revision` the approval record keys off, so
    the "what changed since you approved" timeline interleaves both on one spine.
  - tutor-svc still does not re-check approval. It does not initialise lesson
    paths (learning-svc does), so it is not a teach-gate entry point today; if a
    future tutor-svc route ever becomes one, it must call the same
    `can_teach`/`assert_can_teach` guard.
  - A federated disclosure query (web + services) is a reporting-framework
    follow-up (ADR 0039 territory).

## Alternatives Considered

- **Option (a) — shared contract; web-v2 stays runtime source of truth
  (CHOSEN).** Lowest-risk unification: no network hop on the live path, both
  stacks keep their stores, the *contract* (enum + record + revision) is shared
  and brain-svc adopts it. Cost: parity held by mirrored constants, not codegen;
  two disclosure surfaces. Accepted by the owner as D3(a).
- **Option (b) — brain-svc becomes the system-of-record; web-v2 reads approval
  through the ADR-0009 bridge.** Rejected: it puts a **network dependency on the
  live lesson path** (`createLessonRun` would call brain-svc to learn whether to
  teach), trading a local DB read for a cross-service round-trip on the hottest
  learner path, with a new failure mode (bridge down ⇒ can't teach an approved
  child, or fail-open ⇒ teach an unapproved one). The runtime cost is not worth
  the centralisation when a shared *contract* gets us one definition without the
  hop.
- **Option (c) — retire one stack's brain pipeline.** The honest long-term
  answer and the largest change. Cost: brain-svc owns the clone pipeline, XAI
  generation, pacing, regression analysis, and the curriculum validator (ADR
  0041) — retiring it means re-homing all of that into web-v2 (months), and
  retiring web-v2's pipeline means the live surface takes a hard brain-svc
  dependency for every render. Either direction is a multi-sprint migration with
  a real regression surface. Rejected for this sprint; option (a)'s shared
  contract is the incremental step that *keeps (c) open* (a single contract is a
  prerequisite for ever collapsing to one implementation) without paying its
  cost now.
