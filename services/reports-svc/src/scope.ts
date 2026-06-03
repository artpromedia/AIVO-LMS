/**
 * Caller scope resolution (Sprint 10 RBAC).
 *
 * Maps the authenticated request context (role + tenant) to:
 *   - a `ReportScope` (the highest scope the caller may run), and
 *   - the set of tenant ids the caller may reference in report params.
 *
 * Platform admins span all tenants; district admins span the tenants in their
 * district; school admins span only their own tenant. Non-admins get no
 * reporting scope.
 */
import type { FastifyRequest } from "fastify";
import type { ReportScope } from "./registry/types.js";
import { SEED_TENANTS } from "./registry/seed-data.js";

export interface CallerScope {
  scope: ReportScope | null;
  allowedTenantIds: string[];
  role: string | undefined;
  actorId: string | undefined;
  tenantId: string | undefined;
}

export function resolveCallerScope(request: FastifyRequest): CallerScope {
  const ctx = request.enterpriseContext;
  const role = ctx?.actorRole;
  const tenantId = ctx?.tenant?.tenantId;
  const actorId = ctx?.actorId;

  if (role === "platform_admin") {
    return {
      scope: "platform",
      allowedTenantIds: SEED_TENANTS.map((t) => t.tenantId),
      role,
      actorId,
      tenantId,
    };
  }
  if (role === "district_admin") {
    // The caller's tenant identifies a district via the seed mapping; in
    // production this comes from the tenant hierarchy in tenant-svc.
    const home = SEED_TENANTS.find((t) => t.tenantId === tenantId);
    const districtId = home?.districtId;
    const allowed = SEED_TENANTS.filter((t) => t.districtId === districtId).map((t) => t.tenantId);
    return {
      scope: "district",
      allowedTenantIds: allowed.length ? allowed : tenantId ? [tenantId] : [],
      role,
      actorId,
      tenantId,
    };
  }
  if (role === "school_admin") {
    return {
      scope: "school",
      allowedTenantIds: tenantId ? [tenantId] : [],
      role,
      actorId,
      tenantId,
    };
  }
  return { scope: null, allowedTenantIds: [], role, actorId, tenantId };
}
