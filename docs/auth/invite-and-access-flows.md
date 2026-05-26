# Invite & Access Flows

This page documents the seven invite/role-provisioning flows in AIVO-LMS,
the endpoints and tables behind each one, and where to look in the
codebase. It is the operational source of truth for "how does X get
access to Y" questions.

All flows share a common substrate:

- Identity & roles live in `services/identity-svc` (Fastify + JWT, RS256).
  Canonical roles are defined in
  [`packages/db/src/schema/enums.ts`](../../packages/db/src/schema/enums.ts)
  (`user_role` enum) and mirrored for the nav layer in
  [`packages/nav/src/roles.ts`](../../packages/nav/src/roles.ts).
- Collaboration links (teacher ↔ learner, caregiver ↔ learner, etc.)
  live in `services/family-svc` against tables in
  [`packages/db/src/schema/collaboration.ts`](../../packages/db/src/schema/collaboration.ts).
- All invite emails are dispatched via `services/comms-svc` over internal
  `x-internal-key` endpoints.

## Roles at a glance

| Role | Scope | Provisioned by |
|------|-------|----------------|
| `PLATFORM_ADMIN` | Global | AIVO ops (seed / manual) |
| `DISTRICT_ADMIN` | One tenant (district) | Token-based invite from another DISTRICT_ADMIN |
| `SCHOOL_ADMIN` | One school within a tenant | Token-based invite from a DISTRICT_ADMIN |
| `TEACHER` | School roster + parent-invited learners | Created by DISTRICT_ADMIN (or SCHOOL_ADMIN) via `POST /api/district/staff` |
| `THERAPIST` / `CAREGIVER` | Per-learner, parent-initiated | Parent invite (`learner_therapists` / `learner_caregivers`) |
| `PARENT` | Self-onboarded; controls their `learners` rows | Signup or accept of a teacher-initiated invite |
| `LEARNER` | Created as a child of a PARENT | Parent onboarding |

## The seven flows

### 1. Parent → Therapist

- **Endpoint**: `POST /api/family/collaboration/:learnerId/invite/therapist`
- **Table**: `learner_therapists`
- **Email**: `collaboration_invite` template via
  `POST /api/comms/internal/team-invite`
- **Cap**: 1 therapist per learner (B2C).
- **Source**:
  [`services/family-svc/src/routes/collaboration.ts`](../../services/family-svc/src/routes/collaboration.ts)

### 2. Parent → Teacher

- **Endpoint**: `POST /api/family/collaboration/:learnerId/invite/teacher`
- **Table**: `learner_teachers`
- **Cap**: 1 teacher per learner (B2C plan; upgrade for more).

### 3. Parent → Caregiver

- **Endpoint**: `POST /api/family/collaboration/:learnerId/invite/caregiver`
- **Table**: `learner_caregivers`
- **Cap**: 2 caregivers per learner.

### 4. Teacher → Parent  *(added in Sprint 3 of the invite-flows series)*

The inverse of flow 2. A teacher who runs a classroom containing a
learner can invite that learner's parent to confirm the connection.

- **Endpoint**: `POST /api/family/collaboration/invite-parent`
- **Resend**: `POST /api/family/collaboration/invite-parent/:id/resend`
  (rotates the token, fresh 72h expiry)
- **Revoke**: `DELETE /api/family/collaboration/invite-parent/:id`
- **List**: `GET /api/family/collaboration/invite-parent` (teacher's outgoing)
- **Table**: `teacher_parent_invites` (token-hash + 72h TTL).
- **Email**: `teacher_invite_parent` template via
  `POST /api/comms/internal/teacher-invite-parent`.
- **Authorization**: the calling teacher must run a classroom that
  contains the learner (via `classrooms.teacher_id` +
  `classroom_enrollments`) or already have an ACCEPTED
  `learner_teachers` row for that learner. `SCHOOL_ADMIN` and
  `DISTRICT_ADMIN` can issue on behalf of staff via `teacherUserId`
  in the body.
- **Accept**: handled by the shared
  `POST /api/family/collaboration/accept-invite`. We verify
  `learners.parent_id === claims.sub` (no parent reassignment), expire
  stale rows, and create / promote the matching `learner_teachers`
  ACCEPTED row in the same handler. When the accepting teacher also
  runs a classroom containing the learner, the new `learner_teachers`
  row picks up `classroom_id` automatically (Sprint 4 affinity).

### 5. District Admin → School Admin

- **Endpoint**: `POST /api/district/admins` with `{ role: 'SCHOOL_ADMIN', schoolId }`
  *(role param added in Sprint 1 of invite-flows; `role: 'DISTRICT_ADMIN'`
  is the legacy default)*
- **Step-up**: required (scope `district:admin-mgmt`).
- **Table**: `district_admin_invites` (now carries `role` + `school_id`).
- **Email**: `school_admin_invite` (or `district_admin_invite`) template.
- **Hook**: `services/identity-svc/src/hooks/require-school-admin.ts`
  injects `req.tenantId` and `req.schoolId` for SCHOOL_ADMIN-scoped
  handlers.
- **Source**:
  [`services/identity-svc/src/routes/district-admins.ts`](../../services/identity-svc/src/routes/district-admins.ts)

### 6. School Admin → Teacher (and Therapist / Caregiver)

- **Endpoint**: `POST /api/district/staff` (currently district-admin
  gated; SCHOOL_ADMIN gating arrives with the require-school-admin hook
  being wired onto this route in a follow-up).
- **Behavior**: creates the user row with `must_change_password=true`,
  emails the temporary password via `staff_credentials`. The HTTP
  response does **not** include the temporary password (Sprint 2
  hardening — previously copy-pasted out of band).
- **Email**: `staff_credentials` template via
  `POST /api/comms/internal/staff-credentials`.

### 7. Teacher manages multiple children (unified roster)

- **Endpoint**: `GET /api/teacher/roster` *(added in Sprint 4)*
- **Source**:
  [`services/family-svc/src/routes/collaboration.ts`](../../services/family-svc/src/routes/collaboration.ts)
- Merges two paths into one deduplicated list:
  1. **District roster** — `classroom_enrollments` joined to
     `classrooms.teacher_id`.
  2. **Parent-invite path** — `learner_teachers` ACCEPTED rows for the
     teacher.
- Each entry carries `source: "classroom" | "parent_invite" | "both"`,
  `classroomId`, `classroomName`, `parentName`, and `parentEmail`.

## Invite hygiene  *(Sprint 5)*

- **Resend (generic)**:
  `POST /api/family/collaboration/invites/:kind/:id/resend` where
  `:kind` is one of `teacher | caregiver | therapist | teacher_parent`.
  Re-fires the invite email and bumps `invited_at`; for
  `teacher_parent` it rotates the token and resets the expiry.
- **Revoke (generic)**:
  `DELETE /api/family/collaboration/invites/:kind/:id` sets the row's
  status to `REVOKED`. Blocked once a row is `ACCEPTED`.
- **Rate limit**: in-memory per-inviter token buckets — 10
  invites/hour and 50 invites/day, applied to all four create
  endpoints AND the generic resend. Exceeding either window returns
  `429` with `Retry-After`.

## Accept-invite landing

A single accept endpoint serves all four collaboration kinds:

`POST /api/family/collaboration/accept-invite`

The handler matches PENDING rows by the calling user's email (from JWT
claims) and promotes them to ACCEPTED in one pass. The web app's
`/accept-invite` page lands signed-in users straight through this
endpoint; unauthenticated visitors are bounced to login/signup with the
invite email pre-filled, then routed back to accept once authenticated.

## What's not yet wired

A few items from the invite-flows audit are intentionally not in this
release and are tracked separately:

- **Bulk staff CSV upload** for school admins onboarding many teachers
  at once.
- **SCIM JIT provisioning test coverage** (the SCIM endpoint exists at
  `services/identity-svc/src/routes/scim.ts:44`; no Okta/Entra mock test
  yet).
- **Mobile deep-link accept-invite E2E** for `aivo://accept-invite`.
- **Web prototype → real backend migration** for the district admin
  staff-invite UI (`apps/web-v2/app/admin/district/staff/`) — it still
  writes to an in-memory store rather than calling
  `services/identity-svc`.
