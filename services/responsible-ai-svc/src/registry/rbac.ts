/**
 * RBAC helpers for the Responsible AI Console routes (Sprint 7).
 *
 * | Action                 | platform | district | school |
 * |------------------------|----------|----------|--------|
 * | Manage model registry  |   ✅     |   ❌     |  ❌    |
 * | Edit safety policies   |   ✅     |   ❌     |  ❌    |
 * | Run evals              |   ✅     |   ❌     |  ❌    |
 * | File incident          |   ✅     |   ✅     |  ✅    |
 * | Configure opt-outs     |   ✅     |   ✅(own)|  ✅(own subset) |
 */
import type { FastifyReply, FastifyRequest } from "fastify";

export type Role = string | undefined;

export interface Actor {
  role: Role;
  tenantId?: string;
  actorId?: string;
}

export function actorOf(request: FastifyRequest): Actor {
  const ctx = request.enterpriseContext;
  return {
    role: ctx?.actorRole,
    tenantId: ctx?.tenant?.tenantId,
    actorId: ctx?.actorId,
  };
}

export function isPlatform(a: Actor): boolean {
  return a.role === "platform_admin";
}

export function canManageRegistry(a: Actor): boolean {
  return isPlatform(a);
}
export function canEditPolicies(a: Actor): boolean {
  return isPlatform(a);
}
export function canRunEvals(a: Actor): boolean {
  return isPlatform(a);
}
export function canFileIncident(a: Actor): boolean {
  return ["platform_admin", "district_admin", "school_admin"].includes(a.role ?? "");
}
export function canConfigureOptOut(a: Actor, targetTenantId: string): boolean {
  if (isPlatform(a)) return true;
  if (a.role === "district_admin" || a.role === "school_admin") {
    return a.tenantId === targetTenantId;
  }
  return false;
}

/** Reply 403 helper; returns true when the request was rejected. */
export function deny(reply: FastifyReply, message = "Forbidden"): true {
  reply.code(403).send({ error: message });
  return true;
}
