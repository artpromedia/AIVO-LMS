# Rostering contract (Sprint 12)

This document is the operational contract for school + district
rostering. It pairs with:

- `docs/sis-sync-contract.md` — the original `SisProvider` interface
  + adapter contract (Sprint 09 baseline)
- `services/integration-svc/src/services/{clever,classlink}-adapter.ts`
  — vendor adapters
- `services/integrations-svc/src/routes/connectors.ts` — connector
  REST surface (OAuth, sync trigger, sync logs, roster mappings)
- `apps/web-v2/app/admin/school/rostering/*` — admin UI
- `services/family-svc` — parent consent gates for school roster import
- `scripts/rostering-audit.mjs` (root script `rostering:audit`)

> Sprint 02 documented the `integration-svc` (port 3068, SIS providers
> + LTI 1.3) vs `integrations-svc` (port 3012, connector REST surface)
> split. Both are legitimate. This sprint does not consolidate them;
> see the local-dev guide.

## Import sources

| Source | Path | Status |
|---|---|---|
| OneRoster CSV bundle | admin upload | Sprint 12 baseline |
| OneRoster REST | school SIS pull | Sprint 12 baseline |
| Clever roster JSON export | `createCleverAdapterFromExport` | shipped (legacy) |
| ClassLink roster JSON export | `createClassLinkAdapterFromExport` | shipped (legacy) |
| Manual CSV (schools / classes / teachers / students / guardians / enrollments) | admin upload fallback | Sprint 12 baseline |
| Clever live OAuth | feature flag `cleverLiveSync` | Sprint 12b |
| ClassLink live OAuth | feature flag `classlinkLiveSync` | Sprint 12b |

## Import flow

```
admin uploads / pulls feed
    ↓
preview (per-entity counts, warnings, opt-in vs opt-out per parent)
    ↓
batch insert (transactional; per-row failure does NOT abort the batch)
    ↓
import receipt (per-entity counts, warnings, errors list with row refs)
    ↓
audit events emitted per mutation
    ↓
optional rollback (admin action; reverses batch via batch id)
```

### Per-entity rules

- **Schools / classes**: upserted by external id (idempotent retries).
- **Teachers**: upserted by external id; assigned to classes via
  enrollments.
- **Learners (students)**: upserted by external id; **parent-owned
  profile fields are NEVER overwritten** (accommodations, functioning
  level, delivery level, sensory profile, language profile).
- **Guardians**: upserted by external id; **parent consent is
  required** before linking a child to a school class
  (`school_roster_import` consent type — Sprint 04 matrix).
- **Enrollments**: upserted by `(classId, learnerId)`; idempotent.

### Parent consent

A learner cannot be enrolled in a school class until the parent of
record has granted `school_roster_import` consent. The import flow:

1. The import receipt lists learners blocked by missing consent.
2. Admin can resend the consent email via the receipt UI.
3. Parent grants consent (via `apps/web-v2/app/parent/consent`).
4. The pending enrollment is consumed automatically (next nightly
   reconciliation or admin "retry pending").

This consent gate is enforced **server-side**, not in the UI alone.
`scripts/consent-gate-audit.mjs` already covers the BFF surface;
Sprint 12 extends the coverage with the rostering audit.

### Partial failures

A per-row failure does NOT abort the batch. The import receipt always
shows:

| Field | Meaning |
|---|---|
| `succeeded` | rows applied |
| `pending` | rows held for consent / referential integrity |
| `failed` | rows that errored, with `rowRef` + `error` |
| `skipped` | rows that match an existing record byte-for-byte (no-op) |

The UI surfaces each bucket separately and supports retrying failed
rows after the underlying cause is fixed.

### Rollback

Each import is identified by `batchId`. The receipt UI exposes a
"rollback this batch" action available only to admins with the
`rostering:rollback` permission. Rollback:

1. Marks every mutation in the batch as `reverted`.
2. Restores prior state from the audit ledger (Drizzle transaction).
3. Emits `rostering.batch.rolled_back` audit event with reason.

## Vendor adapter contract

```ts
export interface SisProvider {
  name: string;
  listSchools(): Promise<SisSchool[]>;
  listTeachers(): Promise<SisTeacher[]>;
  listStudents(): Promise<SisStudent[]>;
  listClasses(): Promise<SisClass[]>;
  listEnrollments(): Promise<SisEnrollment[]>;
}
```

Every adapter:

- never reads from outside the provided payload (no live HTTP unless
  the live-sync flag is on)
- normalizes ids to AIVO's `extId` shape
- returns deterministic ordering (sortable by extId)
- declares its own `name` for audit attribution

Add a new vendor by implementing the interface and registering the
adapter in `services/integration-svc/src/services/index.ts`. Do not
fork the importer per vendor.

## Tenant isolation

- A school admin cannot import into another school.
- A district admin cannot import across districts.
- The audit script asserts that every admin BFF route under
  `apps/web-v2/app/api/bff/admin/school/rostering/*` and the
  district equivalent (Sprint 12b) checks the session's tenant
  scope before issuing the import.

## Audit events

- `rostering.import.started` — `{ tenantId, batchId, source, byUser }`
- `rostering.import.completed` — `{ batchId, counts, warnings }`
- `rostering.import.failed` — `{ batchId, error }`
- `rostering.import.partial` — `{ batchId, succeeded, pending, failed, skipped }`
- `rostering.batch.rolled_back` — `{ batchId, reason, byUser }`
- `rostering.consent.pending` — `{ learnerId, parentUserId, reason }`

## Audit script

`scripts/rostering-audit.mjs` (`rostering:audit`):

1. `SisProvider` interface still declares every entity listing
   method (schools, teachers, students, classes, enrollments).
2. Clever + ClassLink adapter factories exist
   (`createCleverAdapterFromExport`, `createClassLinkAdapterFromExport`).
3. `apps/web-v2/app/admin/school/rostering/page.tsx` and
   `apps/web-v2/app/admin/school/rostering/import/page.tsx` exist.
4. The integration-svc SIS route still imports adapters from
   `services/sis-provider-interface.js` (refactor regression check).

## Verification

```bash
pnpm rostering:audit
pnpm --filter @aivo/integration-svc test
pnpm --filter @aivo/integrations-svc test
pnpm test:enterprise
```
