# Comms boundaries (Sprint 13)

This document describes the visibility / posting policy for the messaging
surfaces introduced in Sprint 13. The policy is enforced in code at
`services/comms-svc/src/policy/visibility.ts`; the underlying tables live in
`packages/db/migrations/0046_messaging.sql`.

## Goals

- **No surprise disclosure.** A parent of learner A must never see anything
  about learner B – not the thread, not the existence of the thread, not a
  redacted summary. Every cross-learner access attempt is a 403 (not an
  empty 200, not a 404).
- **One-learner scope.** Every parent/teacher exchange is scoped to a
  specific learner. There are no parent ↔ teacher DMs in the abstract.
- **Lesson-scoped live channel.** Learner ↔ teacher messaging only exists
  inside a lesson context; the channel closes when the lesson ends.
- **Caregivers see, do not write.** A caregiver attached to learner A can
  read parent ↔ teacher threads about learner A but cannot post.
- **Therapist consent is explicit.** A therapist cannot post in a family
  thread unless an `opted_in=true` row exists in `message_consent` for
  the therapist channel and target user.
- **No unrelated-parent DMs.** Two parents with no shared learner cannot
  open a DM. Refused at thread creation time.

## Boundary matrix

| Thread kind             | Allowed authors                                              | Allowed readers                                                     | Posting rules                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parent_teacher`        | Parent(s) of learner, teacher(s) of learner                  | Authors + caregivers of learner (read-only)                         | Thread is scoped to one `learner_id`. Caller must have a parent or teacher relationship to that learner via identity-svc / family-svc.                     |
| `learner_teacher_lesson`| Learner, teacher(s) of the lesson                            | Authors                                                              | `lesson_id` is required. Posting is gated by `learning-svc` confirming the lesson is currently active for that learner.                                    |
| `therapist_family`      | Therapist (with consent), parent(s) of learner               | Therapist (with consent), parent(s) of learner, caregivers (R/O)    | Therapist write requires an `opted_in=true` row in `message_consent` for the therapist's user_id on the `in_app` channel (or whatever channel is in play). |
| `district_announcement` | District admin, school admin                                 | All users in the district whose roles match the announcement scope  | Read-only for everyone outside the admin set. Cross-district read is denied.                                                                               |

## Negative cases that MUST 403

| Scenario                                                                 | Endpoint                                            | Expected                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------- |
| Parent of learner A requesting a thread about learner B                  | `GET /api/comms/threads/:id`                        | 403 (not 404)                             |
| Caregiver of learner A trying to post on a parent↔teacher thread for A   | `POST /api/comms/threads/:id/messages`              | 403                                       |
| Therapist with no consent row trying to view/post a therapist_family thread | `*`                                              | 403 (view AND post)                       |
| Two unrelated parents trying to open a DM                                | `POST /api/comms/threads`                           | 403 at create time                        |
| Learner messaging a teacher with no active lesson                        | `POST /api/comms/threads`                           | 403                                       |
| Cross-tenant access of any thread                                        | `*`                                                 | 403                                       |

## Implementation choices

### Denormalised `tenant_id` on `message_threads`

Tenant scoping is evaluated on every thread fetch. Putting `tenant_id` on
the thread row (rather than joining through learner-svc) keeps the
visibility query a single index lookup and lets the row-level filter run in
the database. `messages` does NOT carry `tenant_id`; it inherits scope
through `thread_id`. This is a conscious denormalisation – noted here so a
future refactor doesn't "fix" it.

### Read-only "observer" participant role

`message_thread_participants.role` is one of `author | reader | observer`.
`canPostToThread` returns `false` for `observer`. Caregivers are added as
`observer` on parent↔teacher threads when their family relationship is
discovered. This avoids putting the read-only rule in a hard-coded `if`
branch on the role string.

### Why a separate `message_consent` table

`identity-svc` already stores high-level notification preferences. We do
not piggy-back on that table because comms consent is per-channel per-user
and needs to be writable from SMS STOP webhooks (Twilio) without coupling
identity-svc to provider webhooks.

## Where this is enforced

- **Service:** `services/comms-svc/src/policy/visibility.ts`
  - `canViewThread(actor, thread, ctx)`
  - `canPostToThread(actor, thread, ctx)`
  - `canCreateThread(actor, intendedKind, learnerId, lessonId, ctx)`
- **Routes:** every handler in `services/comms-svc/src/routes/{threads,messages,attachments}.ts`
  calls one of the three policy functions before doing any database read or
  write.
- **BFF:** `apps/web-v2/app/api/bff/comms/*` wraps the service calls and
  injects the active-tenant header, but does NOT re-implement the policy –
  it relies on the 403 from the upstream service.
- **Tests:** `services/comms-svc/__tests__/visibility.test.ts` exhausts
  every row in the boundary matrix above plus the negative cases.

## SMS opt-out (STOP keyword)

Twilio delivers STOP / UNSTOP keywords to
`POST /api/comms/sms/inbound`. The handler:

1. Verifies the `X-Twilio-Signature` header against the configured
   `TWILIO_WEBHOOK_SIGNING_SECRET`.
2. Resolves the inbound phone number to a user via identity-svc.
3. Upserts `message_consent` with `channel='sms'` and `opted_in=false`
   (STOP) or `opted_in=true` (UNSTOP / START), source `'twilio_webhook'`.
4. Emits an audit event `NOTIFICATION_PREFERENCE_UPDATED`.

A user with `opted_in=false` for `sms` is excluded from any future SMS
dispatch by `TwilioSmsProvider.send` before the API call is made.
