# Sprint 02 — Role-aware child-scoped authorization

## Goal

At the end of this sprint, every child-scoped web-v2 BFF endpoint enforces server-side, role-aware learner scope: parent relationship, learner self-scope, teacher roster/team grant, caregiver accepted care-team grant, therapist accepted care-team grant, and admin permission/scope. Same-tenant learner existence is no longer enough.

## Context

Pillar: **RBAC and caregiver grant enforcement**. This is the second 🚨 blocker. Until this lands, do not expand caregiver/teacher/therapist surfaces.

Current verified evidence:
- `requireLearnerScope` scopes parent access through `parentCanAccessLearner`: `apps/web-v2/lib/bff/guards.ts:69-76`.
- It scopes learner access through `session.learnerId`: `apps/web-v2/lib/bff/guards.ts:78-85`.
- For all other roles it only checks `getLearner(learnerId, session.tenantId)`: `apps/web-v2/lib/bff/guards.ts:87-91`.
- Care-team grant storage exists: `TeamRole = "teacher" | "caregiver" | "therapist"` at `apps/web-v2/lib/db/team-invites.ts:23`; records include learner, tenant, email, member user, and status at `apps/web-v2/lib/db/team-invites.ts:27-44`.
- Accepted team-member lookup exists through `listLearnersForMember`: `apps/web-v2/lib/db/team-invites.ts:223-230`.

Report mapping: closes **Gap 2 / R2** and covers the **child-scoped learner guard 🟡/🚨** and **caregiver grant enforcement 🟡** capability cells.

## Work orders

### DELETE

- Delete the same-tenant fallback authorization semantics in `apps/web-v2/lib/bff/guards.ts` for teacher/caregiver/therapist. It is acceptable to keep a tenant existence check only as an additional admin precondition after explicit role permission checks.
- Delete or update tests that assert a non-parent/non-learner can access any learner in the same tenant purely by existence.

### CREATE

- Create focused helper functions, likely in `apps/web-v2/lib/bff/guards.ts` or `apps/web-v2/lib/bff/learner-scope.ts`:
  - `requireCareTeamScope(session, learnerId, role, requestId)` for caregiver/therapist and optionally team-invite teacher paths.
  - `requireTeacherLearnerScope(session, learnerId, requestId)` using `teacherCanAccessLearner` where roster is authoritative, plus accepted team invite where teacher care-team grants are authoritative.
  - `requireAdminLearnerScope(session, learnerId, requestId)` requiring explicit admin role/permission and tenant/school/district scope.
- Create negative IDOR tests for caregiver, teacher, and therapist across representative child-scoped endpoints:
  - brain profile route.
  - baseline create/complete or read route.
  - recommendations route.
  - lesson-run route.
  - observation route.
  - learner context route.
- Create route-audit documentation or a small test utility enumerating all `/api/bff/**/[learnerId]/**` routes and their expected scope helper.

### REFACTOR

- Refactor `requireLearnerScope` to dispatch by `session.role`:
  - parent → `parentCanAccessLearner`.
  - learner → `session.learnerId === learnerId`.
  - teacher → teacher roster/classroom assignment or accepted teacher team member, depending route domain. Prefer route-specific stricter helpers when domain differs.
  - caregiver → accepted caregiver care-team membership for that learner.
  - therapist → accepted therapist care-team membership for that learner.
  - school/district/platform admins → explicit admin permissions and scoped tenant/school access; platform escape hatches must be named and tested.
- Refactor every `/api/bff/**/[learnerId]/**` route to use the correct helper, not just a generic same-tenant check.
- Refactor any page-level caregiver/therapist/teacher lists to keep using accepted membership, but do not rely on page filtering as authorization.

### EDIT

- Edit `apps/web-v2/lib/bff/guards.test.ts` and related tests to cover each role branch.
- Edit tests for caregiver observations, therapist assessment, teacher assessment, lesson runs, recommendations, brain profile, and learner context so same-tenant non-members receive 403.
- If any directly exposed microservice endpoints bypass web-v2 BFF for these roles, edit their route tests to enforce equivalent role-aware scope or explicitly document that they are internal-only and protected upstream.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **Credential & auth rules (any sprint touching PINs, sessions, or login):** no secret or PIN is ever stored or compared in plaintext — hash with Argon2id or scrypt and verify in constant time; the production service (identity-svc) owns hashing, verification, and server-side lockout (not client-only attempt counts); learner sessions carry a learner-scoped identifier, no adult capabilities, and a shorter lifetime; the PIN auth contract binds the selected `learnerId`.
- **Authorization rules (any sprint touching child-scoped routes):** enforcement is server-side on every endpoint (UI hiding is not a control); scope checks are role-aware (parent relationship / learner-self / accepted care-team membership / teacher roster), never "same-tenant existence"; add negative IDOR tests for caregiver, teacher, and therapist across brain, baseline, recommendations, lesson-run, observation, and learner-context routes.

## Definition of done

Report R2 DoD, verbatim:
- A caregiver invited to learner A receives 403 for learner B in the same tenant across every child-scoped endpoint.

Additional observable behavior:
- A therapist invited to learner A receives 403 for learner B in the same tenant across representative therapist-capable endpoints.
- A teacher without roster/team access receives 403 for learner B even in the same tenant.
- Parent/learner happy paths still pass.
- Admin paths require named admin permissions and remain audited.

Exact verification commands:
- `rg -n "requireLearnerScope\(|\[learnerId\]|learnerId" apps/web-v2/app/api/bff apps/web-v2/lib/bff --glob '!**/node_modules/**'`
- `corepack pnpm --filter @aivo/web-v2 test -- guards`
- `corepack pnpm --filter @aivo/web-v2 test`
- `pnpm test`
- `rg -n "TODO|FIXME|stub|placeholder|mock|not implemented|coming soon" <changed production files>`

## Tests

Write or update:
- Unit tests for each role branch of the new scope helper.
- Route-level tests proving cross-child 403 for caregiver/teacher/therapist on brain, baseline, recommendations, lesson-run, observation, and learner-context routes.
- Regression tests proving parent/learner authorized access still works.

Run the full suite (`pnpm test`) so Sprint 01 remains green.

## Out of scope

- Do not build new caregiver UI capabilities; Sprint 06 owns the full caregiver RBAC variant.
- Do not change PIN auth; Sprint 01 owns it.
- Do not implement the onboarding state machine; Sprint 04 owns it.

## Depends on

- Can run after Sprint 01 or in parallel only if no shared files conflict, but must complete before Sprint 06.
- Cross-track: coordinate with Assessment-UX brain access-control work if it has changed brain-profile routes; do not weaken any stricter scope checks.

## Checkpoint

At sprint end, summarize every route audited, list the negative IDOR tests, include pass/fail commands, and pause for owner review. Do not commit unless explicitly instructed.
