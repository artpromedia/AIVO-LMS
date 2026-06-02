/**
 * Multi-role management (ADR 0020). Lets a privileged admin grant or revoke
 * the *additional* roles a user may act as, beyond their primary `users.role`.
 * These rows populate `availableRoles` in the access-token JWT, which the
 * unified shell's role switcher and the server-side active-role validator
 * consume.
 *
 *   GET    /api/admin/users/:userId/roles            → base + additional roles
 *   POST   /api/admin/users/:userId/roles   { role } → grant a role
 *   DELETE /api/admin/users/:userId/roles/:role      → revoke a role
 *
 * Authz: SCHOOL_ADMIN / DISTRICT_ADMIN (same tenant) or PLATFORM_ADMIN (any).
 * Every grant/revoke writes a hash-chained admin_audit_log row.
 */
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { users, userRoles, adminAuditLog, appendAudit } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

const ADMIN_ROLES = ["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SCHOOL_ADMIN"];
// Roles that may be granted as a *secondary* role.
const GRANTABLE_ROLES = ["PARENT", "TEACHER", "CAREGIVER", "THERAPIST", "LEARNER"];

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization" });
    return null;
  }
  let payload: any;
  try {
    payload = await verifyJWT(auth.slice(7));
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return null;
  }
  if (!ADMIN_ROLES.includes(payload.role)) {
    reply.status(403).send({ error: "Admin access required" });
    return null;
  }
  return payload;
}

function canManage(admin: any, targetTenantId: string): boolean {
  return admin.role === "PLATFORM_ADMIN" || admin.tenantId === targetTenantId;
}

const userIdParam = {
  type: "object",
  required: ["userId"],
  additionalProperties: true,
  properties: { userId: { type: "string" } },
} as const;

export async function registerUserRoleRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/admin/users/:userId/roles",
    { schema: { tags: ["Admin"], params: userIdParam } },
    async (req, reply) => {
      const admin = await requireAdmin(req, reply);
      if (!admin) return;
      const { userId } = req.params as { userId: string };
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!canManage(admin, user.tenantId)) return reply.code(403).send({ error: "Forbidden" });
      const extra = await db
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));
      const additionalRoles = extra.map((r: { role: string }) => r.role);
      return {
        userId,
        baseRole: user.role,
        additionalRoles,
        availableRoles: [user.role, ...additionalRoles.filter((r: string) => r !== user.role)],
      };
    },
  );

  app.post(
    "/api/admin/users/:userId/roles",
    {
      schema: {
        tags: ["Admin"],
        params: userIdParam,
        body: {
          type: "object",
          required: ["role"],
          additionalProperties: true,
          properties: { role: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const admin = await requireAdmin(req, reply);
      if (!admin) return;
      const { userId } = req.params as { userId: string };
      const role = String((req.body as any)?.role || "").toUpperCase();
      if (!GRANTABLE_ROLES.includes(role)) {
        return reply
          .code(400)
          .send({ error: "role must be one of PARENT, TEACHER, CAREGIVER, THERAPIST, LEARNER" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!canManage(admin, user.tenantId)) return reply.code(403).send({ error: "Forbidden" });
      if (role === user.role) {
        return reply.code(409).send({ error: "That is already the user's primary role" });
      }

      const existing = await db
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(userRoles).values({ userId, tenantId: user.tenantId, role });
        await appendAudit(db, "admin_audit_log", adminAuditLog, {
          action: "ROLE_GRANTED",
          actorId: admin.sub,
          actorEmail: admin.email || "",
          actorRole: admin.role,
          onBehalfOfId: userId,
          resourceType: "user",
          resourceId: userId,
          details: { role },
          ipAddress: null,
          userAgent: (req.headers["user-agent"] as string) || null,
          tenantId: user.tenantId,
        });
      }
      return reply.code(201).send({ userId, role, granted: true });
    },
  );

  app.delete(
    "/api/admin/users/:userId/roles/:role",
    {
      schema: {
        tags: ["Admin"],
        params: {
          type: "object",
          required: ["userId", "role"],
          additionalProperties: true,
          properties: { userId: { type: "string" }, role: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const admin = await requireAdmin(req, reply);
      if (!admin) return;
      const { userId, role: roleParam } = req.params as { userId: string; role: string };
      const role = String(roleParam || "").toUpperCase();
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!canManage(admin, user.tenantId)) return reply.code(403).send({ error: "Forbidden" });

      await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "ROLE_REVOKED",
        actorId: admin.sub,
        actorEmail: admin.email || "",
        actorRole: admin.role,
        onBehalfOfId: userId,
        resourceType: "user",
        resourceId: userId,
        details: { role },
        ipAddress: null,
        userAgent: (req.headers["user-agent"] as string) || null,
        tenantId: user.tenantId,
      });
      return { userId, role, revoked: true };
    },
  );
}
