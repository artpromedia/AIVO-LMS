# Audit Event Taxonomy

Audit events are the authoritative log of sensitive operations. The
schema is intentionally narrow so events compose cleanly across services.

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
