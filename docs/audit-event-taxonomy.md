# Audit Event Taxonomy

Audit events are the authoritative log of sensitive operations. The
schema is intentionally narrow so events compose cleanly across services.
Producer events are schema-validated at emit time
(`packages/audit-client/src/schema.ts`): invalid events throw in
development and are emitted with a `schema_violation` marker in
production — never silently dropped.

## Shape

```ts
{
  id: string;
  tenantId?: string;
  actorId?: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  learnerId?: string;
  beforeHash?: string;
  afterHash?: string;
  reason?: string;
  ipHash?: string;
  userAgentHash?: string;
  occurredAt: string;
  metadata: Record<string, unknown>; // redacted
}
```

## Action Vocabulary

- `profile_recommendation_approved`
- `profile_recommendation_amended`
- `profile_recommendation_declined`
- `brain_profile_changed`
- `learner_data_export_requested`
- `learner_data_export_completed`
- `deletion_requested`
- `deletion_approved`
- `deletion_completed`
- `dpa_accepted`
- `sis_import_started`
- `sis_import_completed`
- `teacher_observation_submitted`
- `problem_session_snapshot_saved`

## Sensitive-READ events (Sprint B4)

Mutations are not the whole FERPA story — "who *viewed* this child's
data, when" must be answerable too. The web-admin detail pages that
render PII report each view through
`POST /api/admin-svc/audit-log/read-events`, which appends hash-chained
rows to `admin_audit_log` (platform trail) and, when the resource belongs
to a tenant, to `district_activity_log` (the district's own trail):

| Action                 | Resource type  | Emitted from                                  |
| ---------------------- | -------------- | --------------------------------------------- |
| `admin.user.viewed`    | `user`         | platform user detail page                     |
| `admin.learner.viewed` | `learner`      | learner rows rendered on a user detail page   |
| `admin.dsar.viewed`    | `dsar_request` | DSAR detail page                              |

Rules:

- **Dedupe window: 5 minutes** per (actor, action, resource) —
  `packages/audit-client/src/read-dedupe.ts` (`READ_DEDUPE_WINDOW_MS`).
  A page refresh inside the window is suppressed; a suppressed view does
  NOT extend the window. The map is in-memory per process: across
  replicas/restarts the worst case is an extra *true* event, never a
  lost one. The same window is applied client-side (admin-api) and
  server-side (admin-svc).
- **Detail-level only.** List/search pages are not fanned out into
  per-row read events (200 rows would mean 200 events of noise); a
  learner's data *viewed in detail* is what gets a row. Exports of list
  data are separately audited (below).
- **No content fields.** Read events carry actor, resource type/id, and
  tenant — never IEP text, medical fields, or free text (see Redaction).

## Export & verification events

- `admin.data.exported` — admin-svc CSV exports (audit log, users,
  learners); appended BEFORE streaming so aborted downloads still show.
- `DATA_EXPORT` / `activity.exported` — identity-svc district activity
  export (`/api/district/activity/export`), recorded on BOTH the platform
  trail and the district's own trail.
- `audit.exported` — audit-svc `/export` (canonical event store),
  self-appended to the same chain it exports.

Chain verification is read-only and NOT itself audited (verifying must
not mutate the chain being verified):

- `GET /api/district/activity/verify?from=&to=` — district-facing; the
  range is anchored against the stored hash of the row immediately
  before it (`@aivo/db` `verifyAuditChainRange`).
- `GET /events/verify?from=&to=` — audit-svc canonical store.
- `GET /api/admin-svc/audit-log/verify` — platform-wide, all three
  appendAudit chains.

### Writer key profiles

`appendAudit` hashes exactly the keys the writer passes (canonical JSON
drops `undefined`, keeps `null`), so every writer to a chained table MUST
pass the table's full canonical key set with explicit nulls:

- `admin_audit_log` (11 keys): action, actorId, actorEmail, actorRole,
  onBehalfOfId, resourceType, resourceId, details, ipAddress, userAgent,
  tenantId.
- `district_activity_log` (8 keys): tenantId, action, actorId, actorName,
  onBehalfOfId, resourceType, resourceId, details.

`scripts/audit-trail-audit.mjs` enforces this on every call site. Rows
written before standardization verify against the recorded legacy
profiles in `packages/db/src/audit-chain-verify.ts`.

## Redaction

`redactAuditMetadata` replaces values for these keys with `[redacted]`:
`iepText`, `rawIepText`, `parentPrivateNotes`, `parentNotes`,
`medicalNotes`, `medicalDiagnosis`, `freeFormChat`, `learnerChat`,
`ocrText`, `uploadedOcrText`, `rawText`, `password`, `token`, `secret`,
`apiKey`. Long string values outside that set are truncated.

## Hashes

When a mutation has before/after Brain state, both sides are hashed
(`beforeHash`, `afterHash`) so the audit log can prove what changed
without storing the raw payload.
