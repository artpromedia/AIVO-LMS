# Sprint 06 — Caregiver as an RBAC-restricted parent variant

## Goal

At the end of this sprint, caregiver is not just a route group: it is a fully wired, server-enforced, capability-scoped variant of the parent app. A parent can grant a caregiver scoped access to a specific child, and every caregiver capability is enforced on the server with 403s for parent-only powers.

## Context

Pillars: **app topology** and **RBAC/caregiver grant**.

Dual-stack reality: web-v2 already has caregiver pages and care-team invite persistence. Sprint 02 must have removed the same-tenant IDOR risk first. This sprint expands caregiver only after role-aware scope is enforceable.

Current report evidence:
- Web role model includes caregiver and `ROLE_HOME.caregiver = "/caregiver/home"`: `apps/web-v2/lib/auth/types.ts:3-16` and `apps/web-v2/lib/auth/types.ts:57-62`.
- Caregiver pages call `requirePageRole(["caregiver", "platform_admin"])` in the report's caregiver observations page evidence.
- Care-team records store caregiver role, learner, tenant, email, member user, status, and relationship: `apps/web-v2/lib/db/team-invites.ts:23-44`.
- `listLearnersForMember` resolves accepted learners by role, user/email, and tenant: `apps/web-v2/lib/db/team-invites.ts:223-230`.

Report mapping: closes **R6** and completes caregiver grant enforcement/topology depth beyond Sprint 02's foundation.

## Work orders

### DELETE

- Delete any caregiver UI link that points to parent-only capabilities unless a server-enforced caregiver capability explicitly permits it.
- Delete any caregiver route/BFF behavior that relies on hidden UI instead of permission checks.
- Delete duplicated parent-app copies if they expose restricted data; replace with caregiver-specific view models or shared components fed by caregiver-scoped data.

### CREATE

- Create a caregiver capability model, for example:
  - `caregiver.view_summary`.
  - `caregiver.view_schedule`.
  - `caregiver.add_observation`.
  - `caregiver.view_notifications`.
  - optional `caregiver.view_progress_limited`.
  - Explicitly exclude billing, consent, data export/delete, parent approval, unrestricted brain details, and account management unless owner grants them.
- Create persistence for caregiver grant capabilities if the current care-team record is insufficient:
  - Per learner.
  - Per caregiver member.
  - Capability list.
  - Granted by parent user ID.
  - Created/updated/revoked timestamps.
- Create server helpers such as `requireCaregiverCapability(session, learnerId, capability, requestId)`.
- Create caregiver-scoped BFF view models for shared parent-like components so restricted fields never leave the server.
- Create caregiver-vs-parent permission matrix tests.

### REFACTOR

- Refactor caregiver pages to consume caregiver-scoped BFF endpoints/view models rather than parent endpoints.
- Refactor care-team invite acceptance/grant flow so caregiver capabilities are stored and auditable.
- Refactor caregiver observations to use `requireCaregiverCapability(..., "caregiver.add_observation")` and accepted learner scope.
- Refactor any existing caregiver home/learners/settings pages so each data fetch has a named capability.

### EDIT

- Edit parent team-management UI to show and manage caregiver scope/capabilities clearly.
- Edit caregiver navigation to show only granted capabilities.
- Edit i18n copy to explain caregiver is scoped access granted by a parent, not a full parent account.
- Edit tests for parent-only endpoints to assert caregiver receives 403.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **Credential & auth rules (any sprint touching PINs, sessions, or login):** no secret or PIN is ever stored or compared in plaintext — hash with Argon2id or scrypt and verify in constant time; the production service (identity-svc) owns hashing, verification, and server-side lockout (not client-only attempt counts); learner sessions carry a learner-scoped identifier, no adult capabilities, and a shorter lifetime; the PIN auth contract binds the selected `learnerId`.
- **Authorization rules (any sprint touching child-scoped routes):** enforcement is server-side on every endpoint (UI hiding is not a control); scope checks are role-aware (parent relationship / learner-self / accepted care-team membership / teacher roster), never "same-tenant existence"; add negative IDOR tests for caregiver, teacher, and therapist across brain, baseline, recommendations, lesson-run, observation, and learner-context routes.

## Definition of done

Report R6 build steps, verbatim:
1. Define a caregiver capability set (example: view learner schedule, add observations, view assigned child summary, receive notifications; no billing, no consent, no brain approval unless explicitly delegated, no data export/delete).
2. Store caregiver grant scope per learner and capability in the care-team member record or a new `caregiver_grants` table.
3. Enforce capabilities server-side on every caregiver route and BFF endpoint; do not rely on a separate route tree alone.
4. Make caregiver UI consume the same child-summary components as parent where appropriate but render through caregiver-scoped BFF view models that omit restricted fields.
5. Add a caregiver-vs-parent permission test matrix.

Report R6 DoD, verbatim:
- A caregiver can only act on the learner(s) and capabilities granted by the parent, and every denied parent capability returns 403 server-side.

Exact verification commands:
- `corepack pnpm --filter @aivo/web-v2 test -- caregiver`
- `corepack pnpm --filter @aivo/web-v2 test -- guards`
- `corepack pnpm --filter @aivo/web-v2 test`
- `pnpm test`
- `rg -n "TODO|FIXME|stub|placeholder|mock|not implemented|coming soon" <changed production files>`

## Tests

Write or update:
- Caregiver grant persistence tests.
- Capability helper tests.
- Route tests for every caregiver capability.
- Parent-only denial tests for billing, consent, export/delete, brain approval, unrestricted profile/brain reads, and account management.
- UI tests proving caregiver navigation matches granted capabilities.

Run the full suite so Sprints 01–05 remain green.

## Out of scope

- Do not alter the secure PIN/login flow except as needed for route authorization tests.
- Do not implement caregiver approval of brain changes unless the owner explicitly decided to grant that capability; initial brain approval remains parent-only by default.
- Do not build full mobile caregiver parity unless the owner decided mobile should be complete operational surface; otherwise document companion-lite behavior.

## Depends on

- Depends on Sprint 02 role-aware child scope.
- Should follow Sprint 04 if caregiver capabilities participate in onboarding contributor policy.
- Requires owner decision on caregiver authority over low-risk brain changes and mobile parity depth.
- Cross-track: coordinate with Assessment-UX caregiver polish if it changes caregiver observation forms.

## Checkpoint

At sprint end, summarize the caregiver capability matrix, list every parent-only 403 assertion, list tests run, and pause for owner review. Do not commit unless explicitly instructed.
