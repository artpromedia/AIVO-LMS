# District Enterprise Mode

District enterprise mode adds a District → School → Class hierarchy on
top of the existing family-first AIVO experience. The hierarchy is
**additive**: family-only learners continue to work with `district_id`
unset.

## Feature Flag

`AIVO_FEATURE_DISTRICT_ENTERPRISE_MODE=true` turns on the district
dashboard, roster imports, and aggregate analytics. With the flag off,
the existing dashboards remain the authoritative experience.

## Roles

```
Parent
  - Full governance over child profile where legally appropriate.
  - Can approve/amend/deny profile recommendations.

Teacher
  - Can view assigned learners.
  - Can view instructional profile and accommodations.
  - Can submit observations.
  - Cannot directly mutate parent-governed Brain fields.

School admin
  - Can manage school rosters and teacher assignments.
  - Can view school-level aggregate analytics.
  - Cannot view private parent notes.

District admin
  - Can manage district SIS connections and school hierarchy.
  - Can view district aggregate analytics.
  - Can export district compliance reports.
  - Cannot approve individual learner profile recommendations unless
    also the legally authorized parent or guardian.

Platform admin
  - Operational access only with audit context.
```

Role enforcement lives in
`services/tenant-svc/src/services/tenant-policy.ts` and is built on
`@aivo/enterprise-core` role helpers.

## Routes

```
POST /api/districts
POST /api/districts/:districtId/schools
POST /api/schools/:schoolId/classes
POST /api/rosters/import
```

## Roster Import

`importRoster` is idempotent and preserves parent-owned profile fields
on existing learners. SIS-driven updates only refresh name, school, and
grade.

## Family-Only Coexistence

Learners can exist without a `district_id`. The roster importer never
creates a district where one was not supplied, and the dashboard
checks for tenant scope before requesting district analytics.
