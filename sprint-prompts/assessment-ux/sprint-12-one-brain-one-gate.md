# Sprint C-12 — One brain, one gate: a single approval model, proven across every lesson pipeline

**Stack:** all — `apps/web-v2`, `services/brain-svc`, `services/family-svc`, BFF.
**Report items closed:** Strategic roadmap row "One brain, one gate"; §4.1 point 5 (cross-stack gate), §4.1 point 7 + §3.6 (FERPA disclosure log — "No FERPA disclosure log exists in either stack"); the dual-stack architecture finding itself (report header note).
**Decision gate:** **D3** — the canonical-model question. This sprint **starts** by writing the ADR and pausing for owner sign-off; implementation follows the approved option.

## Goal

At the end of this sprint, there is exactly one answer to "is this child's profile approved, and by whom, under which consent?" — a shared approval/consent contract honored by both stacks, an **explicit** `approval_status` check where the services-side lesson path initializes (today the Python gate is only implicit-by-sequencing), an integration test that proves the teach-gate against **both** lesson pipelines, and a FERPA disclosure log that records every cross-role read of a child's profile with a query surface. The report's central architectural finding — two stacks that disagree about the product's central promise — is closed.

## Context

- **The disagreement (report, architecture note + §4.1 point 5, re-verified at HEAD `32ece1d3`):**
  - web-v2: approval lives in `LearnerBrainProfile.cloneStage/approvalStatus` (`lib/db/types.ts:476` area); after C-01 the lesson pipeline gates on it (`repos.ts` `createLessonRun`); after C-06 a dedicated `brain_profile_approvals` record exists with consent/RAI versions.
  - brain-svc: approval lives in `brain_states.approval_status`; `/approve` enforces COPPA consent + RAI ack (`routes/brain.py:330-432`); learning paths initialize **only inside approve/amend** (`brain.py:478-498`) — an implicit gate. A repo-wide grep shows `approval_status` is referenced by **no other service**: `services/learning-svc` and `services/tutor-svc` never re-check it. If anything else ever calls the learning-svc path-init route (`/api/learning/path/:learnerId/:subject/init` — internal-token protected), nothing at teach time verifies approval.
  - Consent: web-v2 has the real under-13 regime (`lib/bff/consent-guard.ts`, `ConsentRecord` types, age gates); family-svc has a thinner generic `consentRecords` (string-typed, frozen `"1.0"` — `services/family-svc/src/routes/consent.ts`); brain-svc buries consent in `xai_explanation` JSONB (pre-C-06).
  - FERPA: role-scoped **reads** exist (family-svc `collaboration.ts:745-891`; brain-svc post-C-02) but **no disclosure log** records who read which child's data when (verified absent in both stacks).
- **Prereqs in place when this runs:** C-01 (web gate), C-02 (scoped reads), C-06 (approval table + revision + audit events in both stacks). This sprint unifies; it does not re-implement them.
- **ADR conventions:** `docs/adr/` (numbered; see ADR 0040/0041 style). Relevant priors: ADR 0007 (persistence adapter), ADR 0009 (`lib/services/brain-svc.ts` bridge — referenced at `repos.ts:540-541`).
- **D3 options to write up (recommendation (a), per SPRINT-PLAN):**
  - (a) web-v2's store remains the runtime source of truth for the live surface; the **approval/consent contract** (record shape, status enum, revision semantics from C-06) becomes shared (a `packages/` type/schema source both import); brain-svc adopts the same record table and emits/consumes the same statuses; sync direction documented.
  - (b) brain-svc becomes system-of-record; web-v2 reads through the ADR-0009 bridge (cost: the live lesson path takes a network dependency).
  - (c) retire one stack's brain pipeline (largest change; honest long-term option — cost it).

## Work orders

### DELETE
- None until the ADR is approved (option (c) would direct deletions in a follow-up, not here).

### CREATE
1. **ADR `docs/adr/00XX-one-brain-one-gate.md`** (next free number): the three options, costs, the recommendation, the consent-model unification (web-v2's typed consent regime as the standard; family-svc's generic table mapped or deprecated), and the disclosure-log design. **Pause here for owner sign-off on D3 before proceeding.**
2. **Shared approval contract** (per approved option; for (a)): a shared schema/type source (e.g. `packages/db/src/schema/` addition or a small `@aivo/approval-contract` package — choose per repo convention) defining the approval record, status enum, and revision semantics; both stacks' implementations type-check against it.
3. **Explicit services-side gate:** in brain-svc (and/or learning-svc, per where the ADR places it), an explicit `approval_status == 'approved'|'amended'` check at the lesson/path entry point — so the Python gate stops being sequencing-only. Internal-token callers included: the check runs regardless of caller identity.
4. **Cross-stack teach-gate integration test:** a test (or paired tests, runnable in CI) proving: unapproved profile → web-v2 `createLessonRun` refuses (C-01's test extended) **and** services path-init/lesson entry refuses; approved → both proceed. State exactly how the services side is exercised (pytest against brain-svc routes + the learning-svc init contract; if learning-svc cannot run in the test environment, a contract test on the brain-svc side that the init call is gated, with the limitation documented).
5. **FERPA disclosure log:** an append-only record — `(tenantId, learnerId, readerUserId, readerRole, surface/route, dataClass, timestamp)` — written by: family-svc role-scoped brain views (`collaboration.ts:745-891`), brain-svc scoped reads (post-C-02), and web-v2 BFF brain-profile reads. Storage: the existing audit infrastructure if it fits append-only query needs (web-v2 `lib/bff/audit.ts`, brain-svc `audit.py`, `services/audit-svc`) — prefer extending `audit-svc`/existing audit events with a queryable `disclosure` event type over a parallel store; justify the choice in the ADR. **Query surface:** an admin/compliance read endpoint (per-learner, time-bounded) — placement per repo convention (admin-svc or audit-svc); minimal UI not required, endpoint + tests are.
6. Tests per **Tests**.

### REFACTOR
1. (Option (a)) brain-svc approve/amend: write the shared-shape approval record (supplementing C-06's audit events); migrate the JSONB-buried consent fields to the record for new approvals (historical rows left readable; no destructive migration).
2. family-svc consent surface: align to the typed consent regime per the ADR (map or deprecate the generic route — per sign-off).

### EDIT
1. Documentation: `README.md`/`docs/` pointer to the ADR; the dual-stack note in both sprint-plan files updated to reflect the unified model.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report strategic-row DoD, verbatim: **"A single approval/consent data model shared by web-v2 and brain-svc (or one stack retired per ADR); the teach-time gate is asserted by an integration test that runs against both lesson pipelines; FERPA disclosure log records every cross-role read of a child profile."**

Verification:
1. ADR exists, owner-approved (the sign-off recorded in the Checkpoint), and the implementation matches it.
2. The cross-stack gate test(s) green, with the unapproved-refusal proven on both pipelines (paste outputs).
3. Disclosure log: a teacher reading via the family-svc teacher view produces a disclosure row; the compliance query endpoint returns it (test + sample row); web-v2 BFF and brain-svc reads likewise.
4. Both stacks' approve paths write the shared-shape record; `pytest services/brain-svc/tests` and the full repo suite green (C-01..C-11 unregressed).

## Tests

- Cross-stack gate integration tests (CREATE-4).
- Disclosure-log write tests at all three read surfaces + query-endpoint tests (authz: only compliance/admin roles may query).
- Shared-contract type/schema conformance tests in both stacks.
- Run the full suite.

## Out of scope

- Re-approval thresholds and parent notifications (C-13 — it consumes this model).
- Mobile approval parity (D1 follow-up — unblocked by this sprint).
- Retroactive migration of historical consent JSONB beyond readability.

## Depends on

- **C-01, C-02, C-06** (hard). Decision **D3** sign-off mid-sprint (after CREATE-1). C-13 soft-depends on this sprint.

## Checkpoint

Two pauses: (1) after the ADR — present it and wait for D3 sign-off; (2) at sprint end — summarize changed files, paste the cross-stack gate proofs, a sample disclosure row + query result, and the contract-conformance output. **Do not commit unless explicitly told to.**
