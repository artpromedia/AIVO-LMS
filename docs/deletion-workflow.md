# Deletion Workflow

Deletion requests follow an explicit state machine to ensure no learner
data is destroyed while a district legal retention hold is active.

## States

```
PENDING_REVIEW
  -> approve
  -> SOFT_DELETED
       -> mark ready
       -> READY_FOR_HARD_DELETE
            -> finalize
            -> HARD_DELETED

PENDING_REVIEW
  (with active retention hold)
  -> BLOCKED_BY_RETENTION_HOLD
```

Cancellation is permitted from `PENDING_REVIEW` and
`BLOCKED_BY_RETENTION_HOLD`.

## Routes

```
POST /api/deletion-requests
POST /api/deletion-requests/:id/approve
POST /api/deletion-requests/:id/ready-for-hard-delete
POST /api/deletion-requests/:id/finalize
```

## Retention Holds

A retention hold is active when:

- it has no `expiresAt`, **or**
- its `expiresAt` is in the future.

Expired holds are treated as inactive. Tests lock both cases.

## Export Before Delete

By default a deletion request opts the learner into a full data export
artifact bundle (`exportBeforeDelete: true`). The export is generated
before any state change to `SOFT_DELETED`.

## Audit

Every state transition emits an audit event
(`deletion_requested`, `deletion_approved`, `deletion_completed`).
