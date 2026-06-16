---
name: admin-svc overview-route tenant ownership
description: The :tenantId/:schoolId/:districtId path param on admin-svc overview routes must be re-checked against the JWT, not trusted.
---

# admin-svc overview routes — tenant-ownership guard

`admin-svc` "overview" read routes take a tenant-like id in the URL
(`/admin/schools/:schoolId/overview`, `/admin/districts/:districtId/overview`)
and aggregate rows scoped to that id. A role-only auth check is **not enough** —
trusting the path param lets one tenant's admin read another tenant's data
(IDOR / cross-tenant exposure).

**Rule:** after verifying the JWT role, also require the JWT's `tenantId` claim
to equal the path id for tenant-bound roles, and only exempt `PLATFORM_ADMIN`:

```
if (payload.role !== "PLATFORM_ADMIN" && payload.tenantId !== pathId) {
  reply.code(403).send({ error: "forbidden_cross_tenant" }); return null;
}
```

**Why:** the web-admin BFF (`@aivo/admin-api`) always builds these URLs from the
caller's own `session.tenantId`, so the legitimate path always satisfies
`tenantId === pathId`. The guard breaks nothing real and closes the IDOR.

**How to apply:** any new admin-svc route that accepts a tenant/school/district
id in the path must pass that id into the auth helper and enforce the equality
check above. Cover it with an authz test (own=200, other=403, platform=200,
non-admin role=403) following `tests/*-overview-authz.test.ts`.
