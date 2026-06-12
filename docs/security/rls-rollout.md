# Postgres RLS rollout playbook

Sprint 14 shipped the row-level-security backstop for tenant isolation:
policies on the core tenant tables, a non-bypassing `app_runtime` role,
the `withTenantContext` helper, and **family-svc as the first service
enforcing it end-to-end**. This document is the playbook for migrating
the remaining services — it describes shipped reality and the concrete
next steps, nothing aspirational.

## What is enforced today

Migration `packages/db/drizzle/0106_rls_backstop.sql`:

| Table                   | Policy                                                                | Notes |
| ----------------------- | --------------------------------------------------------------------- | ----- |
| `users`                 | `tenant_id = app.tenant_id` (USING + WITH CHECK)                       | `tenant_id` is nullable: platform-staff rows are invisible under a tenant context — tenant services must never enumerate platform staff. |
| `learners`              | tenant policy **plus** `learners_collaboration_read` (SELECT)          | The second policy keys on `app.user_id`: an ACCEPTED row in `learner_teachers` / `learner_caregivers` / `learner_therapists` grants READ of that one learner to that one user. Family collaboration is cross-tenant by design; writes stay tenant-locked. |
| `schools`               | tenant policy                                                          | |
| `classrooms`            | derived via `school_id IN (schools of tenant)`                         | No tenant column; the subquery is itself RLS-scoped (defense in depth). |
| `classroom_enrollments` | derived via `learner_id IN (learners of tenant)`                       | |
| `staff_assignments`     | derived via `school_id IN (schools of tenant)`                         | |

Not policied (deliberately): `nces_districts` / `zip_nces_district`
(public reference data) and every other table — they behave exactly as
before for all roles.

**Rollout model:** RLS without `FORCE` does not bind table owners.
Services still connecting as the owner role (everything except
family-svc) are completely unaffected. Enforcement turns on per service
when its `DATABASE_URL` switches to `app_runtime`.

The chaos proof lives in `packages/db/src/__tests__/rls-policies.test.ts`
(Testcontainers; CI runs it, locally it self-skips without Docker):
unscoped `app_runtime` SELECT on `users`/`learners` returns **zero rows**
with seeded data present; mismatched-tenant writes are rejected by
`WITH CHECK`; the owner connection sees everything.

## The helper

```ts
import { withTenantContext, withoutTenantContext } from "@aivo/db";

await withTenantContext(db, claims.tenantId, async (tx) => {
  // every query here runs with app.tenant_id set (SET LOCAL — scoped to
  // this transaction; can never leak across pooled connections)
}, { userId: claims.sub }); // optional: enables the collaboration read policy

await withoutTenantContext(db, "nightly cross-tenant sweep", async (tx) => {
  // loud, logged, greppable. NOT a bypass: on app_runtime an RLS table
  // still returns zero rows here.
});
```

## Per-service migration steps

1. **Audit the service's table surface.** Every query touching a
   policied table must run inside `withTenantContext` once the service
   moves to `app_runtime` — anything else returns zero rows. Queries on
   un-policied tables work unchanged under plain grants.
2. **Thread the context.** family-svc's seam (the reference): the
   ownership helpers in `services/family-svc/src/auth.ts` self-scope, and
   `runScoped(db, claims, fn)` wraps the remaining call sites. Reads that
   are cross-tenant *by design* (e.g. family-svc's invite auto-accept
   email lookup) use `withoutTenantContext` with a reason and a graceful
   degradation path — find them with `grep -rn withoutTenantContext`.
3. **Switch the role.** Point the service's `DATABASE_URL` at
   `app_runtime` (compose: see the `family-svc` + `app-runtime-init`
   blocks in `docker-compose.e2e.yml`; the password comes from
   `APP_RUNTIME_PASSWORD`, never a migration).
4. **Run the service's suite + compose lane.** Green on `app_runtime` is
   the acceptance bar — flipping back to owner to get green means step 2
   is incomplete.
5. **Record it here.**

## Current state

| Service     | Role          | Status |
| ----------- | ------------- | ------ |
| family-svc  | `app_runtime` | ✅ adopted (Sprint 14): ownership checks + all policied-table reads scoped; cross-tenant enrichments explicitly unscoped with fallbacks (invite auto-accept → standard pending flow; accept-time classroom backfill / teacher-email seed → null/placeholder; cross-tenant roster parent names → null). |
| all others  | owner         | ⏳ pending — unaffected by the policies until they switch. |

## Known degradations on `app_runtime` (family-svc)

These are deliberate, documented trade-offs until a platform email-lookup
policy ships:

- Inviting an email that belongs to an existing user in *another* tenant
  no longer auto-accepts; the invite follows the normal pending flow.
- `teacher_parent` invite acceptance can no longer distinguish a deleted
  learner from a not-visible one, so the not-found path leaves the invite
  PENDING instead of auto-revoking (fail-safe).
- Platform-staff callers (no tenant claim) get zero rows from policied
  tables on `app_runtime` services; platform tooling stays on owner-role
  services (admin-svc).

## Audited-writes gate (same sprint)

`scripts/ci/check-audited-writes.mjs` requires every route file with
POST/PUT/PATCH/DELETE registrations to carry an audit call (`audited()`,
`appendAudit()`, `logAuditEvent()`, `emitFamilyAudit()`) or an
`audit-exempt(<reason>)` marker. `audited-writes-baseline.json` freezes
the per-service non-compliant counts (family-svc: **0**, the reference);
counts may only fall.
