# Comms + notifications contract (Sprint 13)

This document is the source of truth for notifications, messaging,
preference center, parent-teacher boundaries, and delivery audit.

Authoritative locations:

- `services/comms-svc` — send, render, deliver, preference store, in-app
  inbox, webhook event handler
- `services/comms-svc/src/lib/templates.ts` — template renderer +
  `AVAILABLE_TEMPLATES` catalog
- `apps/web-v2/app/api/bff/notification-preferences/route.ts` — UI BFF
  for preference reads/writes
- `apps/web-v2/app/api/bff/notifications/*` — in-app inbox BFF
- `scripts/comms-audit.mjs` (root script `comms:audit`)

## Notification types

Driven by `AVAILABLE_TEMPLATES`. The Sprint 13 baseline ships:

| Template id                  | Channels     | Audience                       |
| ---------------------------- | ------------ | ------------------------------ |
| `welcome`                    | email        | parent (account created)       |
| `collaboration_invite`       | email        | parent / teacher (team invite) |
| `password_reset`             | email        | any signed-up user             |
| `progress_report`            | email        | parent (weekly summary)        |
| `milestone_achieved`         | email + push | parent + learner               |
| `session_reminder`           | push + email | learner + parent               |
| `iep_update`                 | email + push | parent                         |
| `iep_in_review_parent`       | email        | parent                         |
| `iep_finalised_parent`       | email        | parent                         |
| `iep_comment_mention`        | email        | mentioned team member          |
| `iep_progress_note`          | email        | parent                         |
| `iep_progress_report_sent`   | email        | parent                         |
| `iep_amendment_proposed`     | email        | parent                         |
| `iep_amendment_acknowledged` | email        | team                           |
| `iep_review_reminder`        | email        | parent                         |
| `evaluation_submitted`       | email        | parent                         |
| `evaluation_submitted_admin` | email        | district admin                 |
| `evaluation_decided`         | email        | parent                         |
| `mfa_code`                   | email        | any                            |
| `district_admin_invite`      | email        | district admin                 |
| `newsletter_confirmation`    | email        | marketing opt-in               |

Add a new template by extending `AVAILABLE_TEMPLATES` AND writing a
`renderTemplate` branch in the same PR. The audit script enforces
that the catalog and the renderer agree.

## Channels

| Channel | Provider                           | Required env        |
| ------- | ---------------------------------- | ------------------- |
| email   | Postmark                           | `POSTMARK_API_KEY`  |
| in-app  | comms-svc database                 | n/a                 |
| push    | Expo push (mobile)                 | `EXPO_ACCESS_TOKEN` |
| SMS     | provider-pluggable; OFF by default | `SMS_PROVIDER` flag |

The web inbox surface lives at `/parent/notifications`,
`/learner/notifications`, `/teacher/notifications`. The mobile push
routes to the active role's inbox (Sprint 09 contract).

## Preference center

- Endpoint: `GET / PUT /api/comms/preferences/:userId`
- Per-channel granularity (email, push, SMS) per template category.
- `marketing_opt_in` consent (Sprint 04 matrix) gates the marketing
  template categories independently of the per-template toggle. A
  parent who toggles ON a marketing-category template but has not
  granted `marketing_opt_in` is treated as opted out at send time.
- A learner cannot see or change the parent's preferences.

## Parent-teacher boundaries

The teacher communication surface is constrained:

- Teachers can discuss **classroom progress** with the parent.
- Teachers MUST NOT see or transmit **parent-private notes** (notes
  the parent writes in `/parent/learners/[id]` for their own
  reference).
- Teachers MUST NOT see or transmit **raw IEP text** — the Sprint 04
  contract (no raw IEP exposure to teachers) applies to comms as
  well: every IEP-related template uses derived
  `teacher_safe_iep_summary` fields ONLY when the recipient is a
  teacher.
- Teacher access to a learner can be revoked by the parent at any
  time (`teacher_access` consent). Revocation invalidates the
  teacher's view in the next session AND suppresses pending email /
  push (delivery worker re-checks consent before each send).

## Template content rules

The audit script enforces:

- No template body interpolates `iepText` / `iep_doc.body` /
  `rawIep`. Templates may interpolate `iepSummary`, `iepGoal.title`,
  `accommodationsSummary` — derived fields only.
- No template body interpolates `chatTranscript` for non-parent
  audiences.
- No template body interpolates `brainProfileExplanation` to a teacher
  or admin audience.
- Subject lines reference AIVO or a brand-named entity (learner /
  tutor / IEP) so an inbox filter can be authored by the recipient.

## Delivery audit

Every notification send emits:

- `comms.send.queued` — `{ tenantId, templateId, channel, userId }`
- `comms.send.delivered` — webhook-confirmed delivery (email/push)
- `comms.send.bounced` — bounce + reason
- `comms.send.suppressed` — preference / consent suppression with reason
- `comms.preference.updated` — `{ userId, templateId, channel, value }`

`docs/audit-event-taxonomy.md` is the catalog. Add new events there.

## Audit script

`scripts/comms-audit.mjs` (`comms:audit`):

1. `AVAILABLE_TEMPLATES` in `lib/templates.ts` is non-empty.
2. Every id listed in `AVAILABLE_TEMPLATES` appears in the
   `renderTemplate` body (either as a case label or as a referenced
   helper) so the catalog and the renderer cannot drift.
3. No template body interpolates `iepText` / `iepBody` / `rawIep` /
   `chatTranscript` / `brainProfileExplanation` for a teacher /
   admin audience.
4. `apps/web-v2/app/api/bff/notification-preferences/route.ts` exists
   and supports GET + PUT.
5. `apps/web-v2/app/api/bff/notifications/route.ts` and
   `apps/web-v2/app/api/bff/notifications/mark-read/route.ts` exist.

## Verification

```bash
pnpm comms:audit
pnpm --filter @aivo/comms-svc test
pnpm test:enterprise   # IEP comms boundary tests
```
