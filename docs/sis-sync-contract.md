# SIS Sync Contract

The `@aivo/integration-svc` service exposes a `SisProvider` interface
that Clever, ClassLink, or any other compatible SIS can implement.
The default adapters consume normalized JSON exports so districts can
land enterprise mode without immediately wiring live SIS credentials.

## Provider Interface

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

## Import Behavior

- District / school / class records are **upserted** by external id.
- Learners (students) are upserted **without overwriting parent-owned
  profile fields** — accommodations, functioning level, delivery
  level, sensory profile, and language profile stay parent-governed.
- Teachers are assigned by external id.
- Class enrollments are upserted; duplicates are ignored idempotently.
- Each import emits a job result with the per-entity counts and a
  warnings list.
- Each import emits an audit event (audit storage lands in Sprint 09).

## Vendor Adapters

- `createCleverAdapterFromExport(payload)` — schema-compatible
  with the Clever roster JSON export shape.
- `createClassLinkAdapterFromExport(payload)` — schema-compatible
  with the ClassLink roster JSON export shape.

No external credentials are hardcoded. Live API integrations add a
new `SisProvider` implementation without modifying the routes.

## Feature Flag

`AIVO_FEATURE_SIS_SYNC=true` is required to enable the import endpoint
and surface SIS connection state in the district dashboard.
