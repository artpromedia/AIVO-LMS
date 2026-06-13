# Sprint C-02 — Brain access control: scope every brain-svc endpoint; fix the BFF brain-profile route

**Stack:** `services/brain-svc` (primary) + `apps/web-v2` (one BFF route).
**Report items closed:** Top 10 **#2**; roadmap Quick-win rows "Scope brain-svc endpoints" and "Fix BFF brain-profile route"; Learning Brain scorecard "trust & privacy = 2" (partial); report §4.1 point 7.

## Goal

At the end of this sprint, no authenticated user can read or roll back another child's brain data: every brain-svc brain/snapshot endpoint enforces learner-scope using the already-written-but-unused access-control helper, rollback is restricted to parent/admin, and the web-v2 BFF brain-profile route is fixed (missing `await`) and reduced to least privilege so a teacher can no longer fetch a child's `disabilitySignals` and the parent's private assessment summary.

## Context

- **brain-svc** is FastAPI (`services/brain-svc/src/brain_svc/`). `require_auth` (`auth.py:52-92`) only validates the JWT (or the shared inter-service token) — it performs **no learner-scope check**. Its docstring assumes the web-v2 BFF is the only caller, but the service accepts user JWTs directly, so service-level checks are the defense-in-depth layer.
- **The unused helper:** `verify_learner_access(db, auth, learner_id)` in `services/brain-svc/src/brain_svc/services/access_control.py:8-40` already implements the full role matrix — PARENT via `learners.parent_id`, TEACHER/CAREGIVER/THERAPIST via ACCEPTED `learner_teachers`/`learner_caregivers`/`learner_therapists` rows, admin/service bypass. It is imported nowhere in `routes/brain.py` or `routes/snapshots.py`.
- **The holes (report §4.1 point 7, re-verified at HEAD `32ece1d3`):** in `routes/brain.py`, these endpoints have **no scope check at all** after `require_auth`:
  - `GET /{learner_id}` (`:192-202`) — returns the full brain state incl. `disability_signals`, `iep_profile`.
  - `GET /{learner_id}/history` (`:637-643`).
  - `POST /{learner_id}/rollback` (`:645-703`) — **any authenticated user can roll back a child's brain.**
  - `GET /{learner_id}/context` (`:705-763`) — aggregates sensory/IEP/goals/language profiles.
  - `POST /{learner_id}/regression-check` (`:766+`).
  - `POST /{learner_id}/engagement` (`:872-877`) — current check allows **any** user with role `teacher` (lowercase, unrelated to the learner) to write.
  - Both routes in `routes/snapshots.py` (`:9-25`); `GET /detail/{snapshot_id}` doesn't even filter by learner.
  - By contrast, `/review`, `/pre-clone-data`, `/approve`, `/amend`, `/decline` correctly call `_verify_parent_access` (`brain.py:204-217`) — keep those as-is.
- **The BFF route:** `apps/web-v2/app/api/bff/learners/[learnerId]/brain-profile/route.ts`:
  - `:18` allows roles `["parent", "teacher", "school_admin"]` and `:33` returns the **entire** profile — contradicting family-svc's deliberately role-scoped views (teacher view excludes disability signals — `services/family-svc/src/routes/collaboration.ts:745-785`).
  - `:29` is missing `await` on `getBrainProfile(...)` — `profile` is a Promise, the NOT_FOUND branch is unreachable, and the route serializes an empty object. The route is both over-permissioned and broken. The audit found **no in-repo consumer** (parent pages call repos directly) — re-verify with a grep before changing semantics, and state findings in the Checkpoint.

## Work orders

### DELETE
- None.

### CREATE
1. `services/brain-svc/tests/test_brain_access_control.py` — the authorization regression suite (see **Tests**).
2. (web-v2) a BFF contract test for the brain-profile route (location: follow existing BFF route-test conventions in the repo).

### REFACTOR
- None.

### EDIT
1. `services/brain-svc/src/brain_svc/routes/brain.py`:
   - Import `verify_learner_access` from `brain_svc.services.access_control`.
   - Apply it to `GET /{learner_id}`, `GET /{learner_id}/history`, `GET /{learner_id}/context`, `POST /{learner_id}/regression-check`.
   - `POST /{learner_id}/rollback`: replace the absent check with `_verify_parent_access` (parent/admin/service only) — rolling back a child's profile is a guardian act.
   - `POST /{learner_id}/engagement`: replace the role-string check at `:876-877` with: service principal allowed; learner allowed only for self (`auth.sub == learner_id`); otherwise `verify_learner_access` (which already requires an ACCEPTED link for teacher).
2. `services/brain-svc/src/brain_svc/routes/snapshots.py`: both endpoints get `verify_learner_access`; `GET /detail/{snapshot_id}` must resolve the snapshot's `learner_id` first and verify against it (and 404 unknown ids before any data is returned).
3. `apps/web-v2/app/api/bff/learners/[learnerId]/brain-profile/route.ts`:
   - Add the missing `await` (`:29`) so NOT_FOUND works.
   - Reduce `requireRole` to `["parent"]` (least privilege — the recommendation in report §4.1 point 7). Teachers needing pedagogy data have the family-svc role-scoped views; do **not** build a teacher projection here (that, if ever wanted, is a deliberate later decision).
   - Confirm via grep that nothing in-repo consumed the old behavior; document in the Checkpoint.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report roadmap DoD, verbatim: **"Every brain/snapshot route calls `verify_learner_access`; a non-related TEACHER JWT gets 403 on `GET /api/brain/{id}`; rollback is parent/admin-only; tests added."** Plus the roadmap "Fix BFF brain-profile route" row, verbatim: **"`await` added; role list reduced to parent (or a role-scoped projection per family-svc's pattern); contract test asserts a teacher cannot read `disabilitySignals`."**

Verification:
1. `pytest services/brain-svc/tests` green, incl. the new suite and the existing `test_approve_rai_gate.py` (proves `_verify_parent_access` endpoints untouched).
2. Web BFF contract test green: teacher session → 403; parent-of-learner → 200 with a real (awaited) profile object; parent of a *different* learner → 403/404 via `requireLearnerScope`.
3. Full repo suite green.

## Tests

- `services/brain-svc/tests/test_brain_access_control.py`, using the conftest fixtures' style: for each newly-scoped endpoint — unrelated TEACHER → 403; unrelated LEARNER → 403; ACCEPTED teacher (seeded `learner_teachers` row) → 200 on reads; parent → 200; unrelated PARENT → 403; rollback as ACCEPTED teacher → 403, as parent → succeeds; snapshot detail across learners → 403.
- BFF contract test per CREATE-2.
- Run the full suite so previously completed sprints stay green.

## Out of scope

- The lesson teach-gate (C-01) and cross-stack gate unification / FERPA disclosure log (C-12 — note: C-12 will *log* cross-role reads; this sprint only *restricts* them).
- Any UI changes.
- family-svc role-view changes (already correct — used here only as the reference pattern).

## Depends on

- None. Can run parallel to C-01.

## Checkpoint

Summarize changed files; paste the 403/200 test matrix output; report the BFF-consumer grep findings; confirm `test_approve_rai_gate.py` still green. **Pause for owner review. Do not commit unless explicitly told to.**
