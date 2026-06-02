/**
 * Shared route helpers: read the enterprise auth context and enforce the
 * Sprint-5 RBAC matrix. Routes call `actorOf(request)` and the `require*`
 * guards rather than re-deriving roles each time.
 */
import type { FastifyReply, FastifyRequest } from "fastify";

export interface Actor {
  actorId: string | null;
  actorRole: string | null;
  tenantId: string | null;
}

export function actorOf(request: FastifyRequest): Actor {
  const ctx = request.enterpriseContext;
  return {
    actorId: ctx?.actorId ?? null,
    actorRole: ctx?.actorRole ?? null,
    tenantId: ctx?.tenant?.tenantId ?? null,
  };
}

export const isPlatformAdmin = (a: Actor) => a.actorRole === "platform_admin";
export const isDistrictAdmin = (a: Actor) => a.actorRole === "district_admin";
export const isSchoolAdmin = (a: Actor) => a.actorRole === "school_admin";

/** Configure retention / catalog: platform only. */
export function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply): Actor | null {
  const a = actorOf(request);
  if (!isPlatformAdmin(a)) {
    reply.code(403).send({ error: "platform_admin required" });
    return null;
  }
  return a;
}

/** Process DSARs: platform (any) or district_admin (own district). */
export function requireDsarProcessor(request: FastifyRequest, reply: FastifyReply): Actor | null {
  const a = actorOf(request);
  if (isPlatformAdmin(a) || isDistrictAdmin(a)) return a;
  reply.code(403).send({ error: "platform_admin or district_admin required" });
  return null;
}

/**
 * The tenant scope a processor may act on. Platform admins see everything
 * (undefined = no restriction); a district admin is pinned to their tenant.
 */
export function tenantScopeFor(a: Actor): string[] | undefined {
  if (isPlatformAdmin(a)) return undefined;
  return a.tenantId ? [a.tenantId] : [];
}
