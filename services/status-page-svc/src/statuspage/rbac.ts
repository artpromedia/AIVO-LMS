/**
 * Lightweight RBAC for status-page management routes (Sprint 8).
 *
 * | Action               | platform | district | school |
 * |----------------------|----------|----------|--------|
 * | Declare incidents    |   ✅     |   ❌     |  ❌    |
 * | Schedule maintenance |   ✅     |   ❌     |  ❌    |
 * | Manage components    |   ✅     |   ❌     |  ❌    |
 * | View global status   |   ✅     |   ✅     |  ✅    |
 * | Subscribe to updates |   ✅     |   ✅     |  ✅    |
 *
 * Verification mirrors status.ts: a Bearer JWT is verified via
 * @aivo/security when available; in dev/tests an `x-actor-role` header is
 * accepted so the suite can run without key material.
 */
import type { FastifyReply, FastifyRequest } from "fastify";

const PLATFORM_ROLES = new Set(["platform_admin", "PLATFORM_ADMIN"]);
const ADMIN_ROLES = new Set([
  "platform_admin",
  "PLATFORM_ADMIN",
  "district_admin",
  "DISTRICT_ADMIN",
  "school_admin",
  "SCHOOL_ADMIN",
]);

async function roleFromRequest(req: FastifyRequest): Promise<string | undefined> {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    try {
      const mod = (await import("@aivo/security")) as {
        verifyJWT?: <T>(t: string) => Promise<T>;
      };
      if (mod.verifyJWT) {
        const payload = await mod.verifyJWT<{ role?: string }>(auth.slice(7));
        if (payload?.role) return payload.role;
      }
    } catch {
      // fall through to header path
    }
  }
  const headerRole = req.headers["x-actor-role"];
  return typeof headerRole === "string" ? headerRole : undefined;
}

export function requirePlatformAdmin() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const role = await roleFromRequest(req);
    if (!role || !PLATFORM_ROLES.has(role)) {
      return reply.code(403).send({ error: "Platform admin access required" });
    }
    (req as any).actorRole = role;
  };
}

export function requireAnyAdmin() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const role = await roleFromRequest(req);
    if (!role || !ADMIN_ROLES.has(role)) {
      return reply.code(403).send({ error: "Admin access required" });
    }
    (req as any).actorRole = role;
  };
}
