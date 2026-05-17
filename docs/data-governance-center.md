# Data Governance Center

The data governance center exposes parent and district controls over
learner data: audit events, data export, deletion requests, retention
holds, DPA acceptance, and compliance reporting.

## Feature Flag

`AIVO_FEATURE_DATA_GOVERNANCE_CENTER=true` enables the parent data
center and the district compliance page. With the flag off, sensitive
controls are not surfaced in the UI.

## Services

- `@aivo/audit-svc` — append/list/count audit events; redacts sensitive
  metadata before persistence.
- `@aivo/data-governance-svc` — builds parent exports, manages deletion
  workflow, DPA acceptance, and retention policy decisions.

## Audit Emission

Every sensitive mutation emits an event:

```
profile_recommendation_approved
profile_recommendation_amended
profile_recommendation_declined
brain_profile_changed
learner_data_export_requested
learner_data_export_completed
deletion_requested
deletion_approved
deletion_completed
dpa_accepted
sis_import_started
sis_import_completed
teacher_observation_submitted
problem_session_snapshot_saved
```

Audit metadata is run through `redactAuditMetadata` so it never carries
raw IEP text, parent private notes, medical notes, free-form chat, OCR
text, secrets, or tokens.
