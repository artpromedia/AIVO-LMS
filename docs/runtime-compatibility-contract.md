# Runtime Compatibility Contract

This contract governs how enterprise capabilities are added to
`aivo-ai-learning` without disrupting existing learner, parent, baseline,
tutor, assessment, and Brain flows.

## 1. Route Contracts

- Existing route paths and payload shapes remain valid.
- New enterprise routes are **additive** and live alongside current routes.
- If a route gains new fields, those fields are optional or only populated
  when the corresponding feature flag is on.
- Adapters never mutate or remove existing response keys.

## 2. Feature Flags

- Every new runtime behavior is guarded by a flag in `@aivo/feature-flags`.
- Flags default to **false** unless a development-only preview is explicitly
  enabled for local development.
- When a flag is off, every existing test must pass with no change in
  behavior.
- When a flag is on, every test must also pass.

## 3. Database Changes

- Migrations are **additive only**: new tables, new optional columns.
- No column is dropped, renamed, or made required against existing rows.
- Every migration is reversible.
- Cross-service references use IDs only; no foreign-key surgery across
  bounded contexts.

## 4. Audit Emission

- Once `services/audit-svc` lands in Sprint 09, every sensitive mutation
  emits an audit event. Until then, mutations construct an `AuditContext`
  (via `@aivo/enterprise-core`) so the event payload is ready to ship.
- Sensitive raw text (IEP, parent notes, OCR text) **must never** appear in
  audit metadata. Only safe summaries and hashes are persisted.

## 5. Parent-Owned Profile Fields

- Parent-owned profile fields (accommodations, functioning level, delivery
  level, sensory profile, language supports) cannot be mutated by any role
  other than `parent` or `service` unless an explicit, audited workflow
  exists.
- Profile change recommendations require parent approval (accept, amend, or
  deny).

## 6. Teacher Observations

- Teachers may submit observations. Observations are **non-authoritative**
  and never directly mutate parent-governed fields.
- Observations may be promoted to recommendations through the recommendation
  service (Sprint 07), which still requires parent approval before any
  effect is applied.

## 7. District-Aggregate vs Private Notes

- District admins can view aggregate analytics for their district.
- District admins **cannot** view raw parent private notes, raw IEP text,
  or per-learner free-form learner work content unless they are the
  legally authorized parent or guardian.
- Aggregate analytics are computed from redacted summaries only.

## 8. Platform Admin

- Platform admin operations are operational-only and require audit context
  for every action.

## 9. Test Strategy

- Every new package and service ships unit tests.
- Adapter tests prove that the legacy flow is unchanged with the flag off.
- Integration tests (added by Sprint 10) act as release gates: they fail if
  any of the contracts above are violated.
