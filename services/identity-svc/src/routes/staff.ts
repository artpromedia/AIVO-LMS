import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import argon2 from "argon2";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { adminAuditLog, appendAudit, users } from "@aivo/db";
import { Permission, verifyJWT } from "@aivo/security";
import { delegatedAdminRbacV2Enabled, requestHasPermission } from "../lib/permissions.js";
import { requireStepUp } from "./step-up.js";

const INTERNAL_STAFF_ROLES = [
  "PLATFORM_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
  "ENGINEERING",
] as const;

const MANAGED_PLATFORM_STAFF_ROLES = [
  "SUPPORT",
  "MARKETING",
  "SALES",
  "DEVOPS",
  "ENGINEERING",
] as const;

const IS_PROD = process.env.NODE_ENV === "production";

function requireUrl(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (IS_PROD) throw new Error(`identity-svc: ${name} must be set in production`);
  return devDefault;
}

const COMMS_SVC_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3003");
const LOGIN_URL = process.env.WEB_ADMIN_LOGIN_URL || "https://admin.aivolearning.com/login";

function isManagedPlatformStaffRole(role: string): role is (typeof MANAGED_PLATFORM_STAFF_ROLES)[number] {
  return (MANAGED_PLATFORM_STAFF_ROLES as readonly string[]).includes(role);
}

function hasRoutePermission(
  payload: { role?: string | null; permissions?: readonly string[] | null },
  permission: Permission,
  fallbackRoles: readonly string[],
): boolean {
  if (!payload.role) return false;
  if (!delegatedAdminRbacV2Enabled()) {
    return fallbackRoles.includes(payload.role);
  }
  return requestHasPermission(payload, permission);
}

async function requirePlatformStaffActor(req: any, reply: any) {
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
  if (!(INTERNAL_STAFF_ROLES as readonly string[]).includes(payload.role)) {
    reply.status(403).send({ error: "Platform staff access required" });
    return null;
  }
  req.user = payload;
  return payload;
}

function ensurePermission(
  reply: any,
  payload: { role?: string | null; permissions?: readonly string[] | null },
  permission: Permission,
  fallbackRoles: readonly string[],
): boolean {
  if (hasRoutePermission(payload, permission, fallbackRoles)) return true;
  reply.status(403).send({ error: "Forbidden" });
  return false;
}

async function sendPlatformStaffCredentials(opts: {
  to: string;
  name: string;
  roleLabel: string;
  tempPassword: string;
}) {
  const internalKey = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");
  await fetch(`${COMMS_SVC_URL}/api/comms/internal/staff-credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-key": internalKey,
    },
    body: JSON.stringify({
      to: opts.to,
      name: opts.name,
      roleLabel: opts.roleLabel,
      schoolName: "AIVO platform",
      tempPassword: opts.tempPassword,
      loginUrl: LOGIN_URL,
    }),
  });
}

async function appendPlatformStaffAudit(
  db: any,
  req: any,
  action: string,
  resourceId: string,
  details: Record<string, unknown>,
) {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    tenantId: req.user.tenantId,
    action,
    actorId: req.user.sub,
    actorEmail: req.user.email || "",
    actorRole: req.user.role,
    onBehalfOfId: null,
    resourceType: "platform_staff",
    resourceId,
    details,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers["user-agent"] as string) || null,
  });
}

export async function registerStaffRoutes(app: FastifyInstance) {
  const db = (app as any).db;
  const roleChangeStepUp = requireStepUp("role:change");

  app.get("/api/admin/staff", async (req: any, reply: any) => {
    const actor = await requirePlatformStaffActor(req, reply);
    if (!actor) return;
    if (!ensurePermission(reply, actor, Permission.UserRead, ["PLATFORM_ADMIN"])) return;

    const rows = await db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        email: users.email,
        name: users.name,
        role: users.role,
        mustChangePassword: users.mustChangePassword,
        deactivatedAt: users.deactivatedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(inArray(users.role as any, [...MANAGED_PLATFORM_STAFF_ROLES] as readonly string[]));

    return {
      staff: rows.map((row: any) => ({
        ...row,
        active: !row.deactivatedAt,
      })),
    };
  });

  app.post(
    "/api/admin/staff",
    { preHandler: [requirePlatformStaffActor as any, roleChangeStepUp as any] },
    async (req: any, reply: any) => {
      if (!ensurePermission(reply, req.user, Permission.StaffProvision, ["PLATFORM_ADMIN"])) return;

      const { email, name, role } = (req.body || {}) as {
        email?: string;
        name?: string;
        role?: string;
      };
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const displayName = String(name || "").trim();
      const normalizedRole = String(role || "").trim().toUpperCase();

      if (!normalizedEmail || !displayName || !normalizedRole) {
        return reply.status(400).send({ error: "email, name, and role are required" });
      }
      if (!isManagedPlatformStaffRole(normalizedRole)) {
        return reply.status(400).send({
          error: `role must be one of ${MANAGED_PLATFORM_STAFF_ROLES.join(", ")}`,
        });
      }

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (existing) {
        return reply.status(409).send({ error: "Email already in use" });
      }

      const tempPassword = crypto.randomBytes(15).toString("base64url");
      const [user] = await db
        .insert(users)
        .values({
          tenantId: req.user.tenantId,
          email: normalizedEmail,
          name: displayName,
          role: normalizedRole,
          passwordHash: await argon2.hash(tempPassword, { type: argon2.argon2id }),
          mustChangePassword: true,
          passwordChangedAt: new Date(),
        } as any)
        .returning();

      try {
        await sendPlatformStaffCredentials({
          to: normalizedEmail,
          name: displayName,
          roleLabel: normalizedRole.toLowerCase().replace(/_/g, " "),
          tempPassword,
        });
      } catch (err) {
        req.log?.warn?.({ err: String(err), email: normalizedEmail }, "platform staff email dispatch failed");
      }

      await appendPlatformStaffAudit(db, req, "platform_staff.created", user.id, {
        email: normalizedEmail,
        role: normalizedRole,
      });

      return reply.status(201).send({
        user: {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: true,
        },
        credentialDelivery: IS_PROD ? "email" : "response",
        ...(IS_PROD ? {} : { tempPassword }),
      });
    },
  );

  app.post(
    "/api/admin/staff/:id/reset-password",
    { preHandler: [requirePlatformStaffActor as any, roleChangeStepUp as any] },
    async (req: any, reply: any) => {
      if (!ensurePermission(reply, req.user, Permission.StaffProvision, ["PLATFORM_ADMIN"])) return;
      const { id } = req.params as { id: string };
      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), inArray(users.role as any, [...MANAGED_PLATFORM_STAFF_ROLES] as readonly string[])))
        .limit(1);
      if (!target) return reply.status(404).send({ error: "Platform staff account not found" });

      const tempPassword = crypto.randomBytes(15).toString("base64url");
      await db
        .update(users)
        .set({
          passwordHash: await argon2.hash(tempPassword, { type: argon2.argon2id }),
          mustChangePassword: true,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, id));

      try {
        await sendPlatformStaffCredentials({
          to: target.email,
          name: target.name,
          roleLabel: target.role.toLowerCase().replace(/_/g, " "),
          tempPassword,
        });
      } catch (err) {
        req.log?.warn?.({ err: String(err), email: target.email }, "platform staff reset email dispatch failed");
      }

      await appendPlatformStaffAudit(db, req, "platform_staff.password_reset", id, {
        email: target.email,
        role: target.role,
      });

      return {
        success: true,
        credentialDelivery: IS_PROD ? "email" : "response",
        ...(IS_PROD ? {} : { tempPassword }),
      };
    },
  );

  app.post(
    "/api/admin/staff/:id/deactivate",
    { preHandler: [requirePlatformStaffActor as any, roleChangeStepUp as any] },
    async (req: any, reply: any) => {
      if (!ensurePermission(reply, req.user, Permission.StaffProvision, ["PLATFORM_ADMIN"])) return;
      const { id } = req.params as { id: string };
      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), inArray(users.role as any, [...MANAGED_PLATFORM_STAFF_ROLES] as readonly string[])))
        .limit(1);
      if (!target) return reply.status(404).send({ error: "Platform staff account not found" });
      if (target.deactivatedAt) return reply.status(400).send({ error: "Account already deactivated" });

      await db
        .update(users)
        .set({ deactivatedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, id));

      await appendPlatformStaffAudit(db, req, "platform_staff.deactivated", id, {
        email: target.email,
        role: target.role,
      });
      return { success: true };
    },
  );

  app.post(
    "/api/admin/staff/:id/reactivate",
    { preHandler: [requirePlatformStaffActor as any, roleChangeStepUp as any] },
    async (req: any, reply: any) => {
      if (!ensurePermission(reply, req.user, Permission.StaffProvision, ["PLATFORM_ADMIN"])) return;
      const { id } = req.params as { id: string };
      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), inArray(users.role as any, [...MANAGED_PLATFORM_STAFF_ROLES] as readonly string[])))
        .limit(1);
      if (!target) return reply.status(404).send({ error: "Platform staff account not found" });
      if (!target.deactivatedAt) return reply.status(400).send({ error: "Account is already active" });

      await db
        .update(users)
        .set({ deactivatedAt: null, updatedAt: new Date() })
        .where(eq(users.id, id));

      await appendPlatformStaffAudit(db, req, "platform_staff.reactivated", id, {
        email: target.email,
        role: target.role,
      });
      return { success: true };
    },
  );
}
