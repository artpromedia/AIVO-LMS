/**
 * Multi-role management (ADR 0020). Lets a privileged admin grant or revoke
 * the *additional* roles a user may act as, beyond their primary `users.role`.
 *
 *   GET    /api/admin/users/:userId/roles            → base + additional roles
 *   POST   /api/admin/users/:userId/roles   { role } → grant a role
 *   DELETE /api/admin/users/:userId/roles/:role      → revoke a role
 *
 * The delegated-admin rollout flag preserves the legacy role-based behavior
 * when OFF and switches to permission-based grant enforcement when ON.
 */
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { users, userRoles, adminAuditLog, appendAudit } from "@aivo/db";
import { Permission, verifyJWT } from "@aivo/security";
import { delegatedAdminRbacV2Enabled, requestHasPermission } from "../lib/permissions.js";
import { requireStepUp } from "./step-up.js";

const SCHOOL_AND_DISTRICT_ADMIN_ROLES = ["DISTRICT_ADMIN", "SCHOOL_ADMIN"] as const;
const PLATFORM_OPERATOR_ROLES = [
  "PLATFORM_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
  "ENGINEERING",
] as const;
const ROUTE_ROLES = [...SCHOOL_AND_DISTRICT_ADMIN_ROLES, ...PLATFORM_OPERATOR_ROLES] as const;
const LEGACY_GRANTABLE_ROLES = ["PARENT", "TEACHER", "CAREGIVER", "THERAPIST", "LEARNER"] as const;
const PLATFORM_STAFF_ROLES = ["SUPPORT", "MARKETING", "SALES", "DEVOPS", "ENGINEERING"] as const;
const GRANTABLE_ROLES = [...LEGACY_GRANTABLE_ROLES, ...PLATFORM_STAFF_ROLES] as const;

type JwtActor = {
  sub: string;
  email?: string;
  role: string;
  tenantId?: string;
  permissions?: string[];
};

function isPlatformOperatorRole(role: string): boolean {
  return (PLATFORM_OPERATOR_ROLES as readonly string[]).includes(role);
}

function isGrantableRole(role: string): role is (typeof GRANTABLE_ROLES)[number] {
  return (GRANTABLE_ROLES as readonly string[]).includes(role);
}

function isLegacyGrantableRole(role: string): boolean {
  return (LEGACY_GRANTABLE_ROLES as readonly string[]).includes(role);
}

async function requireAdmin(req: any, reply: any): Promise<JwtActor | null> {
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
  if (!(ROUTE_ROLES as readonly string[]).includes(payload.role)) {
    reply.status(403).send({ error: "Admin access required" });
    return null;
  }
  req.user = payload;
  return payload;
}

function canManage(admin: JwtActor, targetTenantId: string): boolean {
  return admin.role === "PLATFORM_ADMIN" || isPlatformOperatorRole(admin.role) || admin.tenantId === targetTenantId;
}

function actorMayGrantRole(admin: JwtActor, targetRole: string): boolean {
  if (!delegatedAdminRbacV2Enabled()) {
    return (
      ["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SCHOOL_ADMIN"].includes(admin.role) &&
      isLegacyGrantableRole(targetRole)
    );
  }

  if (!requestHasPermission(admin, Permission.RoleGrant)) return false;
  if (admin.role === "PLATFORM_ADMIN") return isGrantableRole(targetRole);
  if (isPlatformOperatorRole(admin.role)) {
    return (PLATFORM_STAFF_ROLES as readonly string[]).includes(targetRole);
  }
  return isLegacyGrantableRole(targetRole);
}

const userIdParam = {
  type: "object",
  required: ["userId"],
  additionalProperties: true,
  properties: { userId: { type: "string" } },
} as const;

export async function registerUserRoleRoutes(app: FastifyInstance) {
  const db = (app as any).db;
  const roleChangeStepUp = requireStepUp("role:change");

  app.get(
    "/api/admin/users/:userId/roles",
    { schema: { tags: ["Admin"], params: userIdParam }, preHandler: requireAdmin as any },
    async (req, reply) => {
      const admin = req.user as JwtActor;
      const { userId } = req.params as { userId: string };
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!canManage(admin, user.tenantId)) return reply.code(403).send({ error: "Forbidden" });
      const extra = await db
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));
      const additionalRoles = extra.map((row: { role: string }) => row.role);
      return {
        userId,
        baseRole: user.role,
        additionalRoles,
        availableRoles: [user.role, ...additionalRoles.filter((role: string) => role !== user.role)],
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
      preHandler: [requireAdmin as any, roleChangeStepUp as any],
    },
    async (req, reply) => {
      const admin = req.user as JwtActor;
      const { userId } = req.params as { userId: string };
      const role = String((req.body as any)?.role || "").toUpperCase();
      if (!isGrantableRole(role)) {
        return reply.code(400).send({
          error: `role must be one of ${GRANTABLE_ROLES.join(", ")}`,
        });
      }
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!canManage(admin, user.tenantId)) return reply.code(403).send({ error: "Forbidden" });
      if (!actorMayGrantRole(admin, role)) return reply.code(403).send({ error: "Forbidden" });
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
      preHandler: [requireAdmin as any, roleChangeStepUp as any],
    },
    async (req, reply) => {
      const admin = req.user as JwtActor;
      const { userId, role: roleParam } = req.params as { userId: string; role: string };
      const role = String(roleParam || "").toUpperCase();
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!canManage(admin, user.tenantId)) return reply.code(403).send({ error: "Forbidden" });
      if (!actorMayGrantRole(admin, role)) return reply.code(403).send({ error: "Forbidden" });

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
