import { FastifyInstance } from "fastify";
import {
  users,
  learners,
  tenants,
  sensoryProfiles,
  consentRecords,
  sessions,
  adminAuditLog,
  appendAudit,
  districtAdminInvites,
} from "@aivo/db";
import { signJWT, verifyJWT } from "@aivo/security";
import {
  getAdminStatsSchema,
  getAdminUsersSchema,
  getAdminUsersByIdSchema,
  updateAdminUsersByIdSchema,
  deleteAdminUsersByIdSchema,
  adminUsersByIdReactivateSchema,
  adminUsersByIdResetPasswordSchema,
  getAdminLearnersSchema,
  getAdminLearnersByIdSchema,
  getAdminTenantsSchema,
  getAdminTenantsByIdSchema,
  updateAdminTenantsByIdSchema,
  adminImpersonateEndSchema,
} from "./schemas.js";

function clientIp(req: any): string | null {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
}
import { eq, sql, desc, ilike, or, and, count, asc, isNull, gt } from "drizzle-orm";
import argon2 from "argon2";
import crypto from "crypto";
import { requireStepUp } from "./step-up.js";
import { deprecateRoute } from "../lib/deprecation.js";
import {
  recordDistrictInviteCreated,
  recordDistrictInviteRevoked,
} from "../lib/district-onboarding-observability.js";

// Sprint 10: legacy admin reads now live behind admin-svc. Mark them
// deprecated for one cycle (default 90 days). Mutations remain canonical
// here.
const dStats = deprecateRoute({ successor: "/api/admin-svc/stats" });
const dUsers = deprecateRoute({ successor: "/api/admin-svc/users" });
const dUserId = deprecateRoute({ successor: "/api/admin-svc/users/:id" });
const dLearn = deprecateRoute({ successor: "/api/admin-svc/learners" });
const dLearnId = deprecateRoute({ successor: "/api/admin-svc/learners/:id" });
const dTen = deprecateRoute({ successor: "/api/admin-svc/tenants" });
const dTenId = deprecateRoute({ successor: "/api/admin-svc/tenants/:id" });

const ADMIN_ROLES = ["PLATFORM_ADMIN", "DISTRICT_ADMIN"];
const INTERNAL_ROLES = [
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
];
const INVITE_TTL_HOURS = 72;
const COMMS_SVC_URL = process.env.COMMS_SVC_URL || "http://localhost:3003";

function hashInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function sendDistrictAdminInvite(input: {
  to: string;
  name: string;
  districtName: string;
  inviteUrl: string;
}): Promise<{ inviteUrl?: string }> {
  const internalKey =
    process.env.INTERNAL_SERVICE_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
  const response = await fetch(`${COMMS_SVC_URL}/api/comms/internal/district-admin-invite`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-key": internalKey },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(5000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Failed to send district admin invite",
    );
  }
  if (payload.status === "dev_mode") {
    if (process.env.NODE_ENV !== "production" && typeof payload.inviteUrl === "string") {
      return { inviteUrl: payload.inviteUrl };
    }
    throw new Error("District invite email service is not configured");
  }
  return {};
}

function platformInviteStatus(invite: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): "pending" | "accepted" | "expired" | "revoked" {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt < new Date()) return "expired";
  return "pending";
}

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!INTERNAL_ROLES.includes(payload.role as string)) {
      return reply.status(403).send({ error: "Admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

async function requirePlatformAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN") {
      return reply.status(403).send({ error: "Platform admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function registerAdminRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/admin/stats",
    { schema: getAdminStatsSchema, preHandler: [dStats, requireAdmin] },
    async () => {
      const [userCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
      const [learnerCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(learners);
      const [tenantCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(tenants);

      const roleCounts = await db
        .select({ role: users.role, count: sql<number>`COUNT(*)` })
        .from(users)
        .groupBy(users.role);

      const recentUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(10);

      const recentLearners = await db
        .select({
          id: learners.id,
          name: learners.name,
          functioningLevel: learners.functioningLevel,
          gradeLevel: learners.gradeLevel,
          createdAt: learners.createdAt,
        })
        .from(learners)
        .orderBy(desc(learners.createdAt))
        .limit(10);

      return {
        totalUsers: Number(userCount.count),
        totalLearners: Number(learnerCount.count),
        totalTenants: Number(tenantCount.count),
        roleCounts: roleCounts.map((r: any) => ({ role: r.role, count: Number(r.count) })),
        recentUsers,
        recentLearners,
      };
    },
  );

  app.get(
    "/api/admin/users",
    { schema: getAdminUsersSchema, preHandler: [dUsers, requireAdmin] },
    async (req) => {
      const {
        role,
        page: pageStr,
        pageSize: pageSizeStr,
        search,
        sort,
        order,
      } = req.query as {
        role?: string;
        page?: string;
        pageSize?: string;
        search?: string;
        sort?: string;
        order?: string;
      };
      const page = Math.max(1, parseInt(pageStr || "1") || 1);
      const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr || "50") || 50), 200);
      const offset = (page - 1) * pageSize;

      const conditions: any[] = [];
      if (role) conditions.push(eq(users.role, role as any));
      if (search) {
        conditions.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol =
        sort === "name"
          ? users.name
          : sort === "email"
            ? users.email
            : sort === "role"
              ? users.role
              : users.createdAt;
      const sortDir = order === "asc" ? asc(sortCol) : desc(sortCol);

      const [totalResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .where(whereClause);

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          tenantId: users.tenantId,
          deactivatedAt: users.deactivatedAt,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(whereClause)
        .orderBy(sortDir)
        .limit(pageSize)
        .offset(offset);

      return { users: rows, total: Number(totalResult.count), page, pageSize };
    },
  );

  app.get(
    "/api/admin/users/:id",
    { schema: getAdminUsersByIdSchema, preHandler: [dUserId, requireAdmin] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          tenantId: users.tenantId,
          emailVerified: users.emailVerified,
          avatarUrl: users.avatarUrl,
          hasGoogle: sql<boolean>`${users.googleId} IS NOT NULL`.as("has_google"),
          hasApple: sql<boolean>`${users.appleId} IS NOT NULL`.as("has_apple"),
          deactivatedAt: users.deactivatedAt,
          lastLoginAt: users.lastLoginAt,
          lastLoginIp: users.lastLoginIp,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) return reply.status(404).send({ error: "User not found" });

      const userLearners = await db
        .select({
          id: learners.id,
          name: learners.name,
          functioningLevel: learners.functioningLevel,
          gradeLevel: learners.gradeLevel,
          createdAt: learners.createdAt,
        })
        .from(learners)
        .where(eq(learners.parentId, id));

      let tenant = null;
      if (user.tenantId) {
        const [t] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
        tenant = t || null;
      }

      const activeSessions = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(sessions)
        .where(and(eq(sessions.userId, id), sql`${sessions.expiresAt} > NOW()`));

      return {
        ...user,
        tenant,
        learners: userLearners,
        activeSessions: Number(activeSessions[0]?.count || 0),
      };
    },
  );

  app.put(
    "/api/admin/users/:id",
    {
      schema: updateAdminUsersByIdSchema,
      preHandler: [requirePlatformAdmin, requireStepUp("role:change")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as any;

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "User not found" });

      const allowedFields: Record<string, any> = {};
      if (body.name !== undefined) allowedFields.name = body.name;
      if (body.email !== undefined) allowedFields.email = body.email;
      if (body.role !== undefined) allowedFields.role = body.role;
      if (body.tenantId !== undefined) allowedFields.tenantId = body.tenantId || null;
      if (body.avatarUrl !== undefined) allowedFields.avatarUrl = body.avatarUrl;

      if (Object.keys(allowedFields).length === 0) {
        return reply.status(400).send({ error: "No valid fields to update" });
      }

      allowedFields.updatedAt = new Date();

      const [updated] = await db
        .update(users)
        .set(allowedFields)
        .where(eq(users.id, id))
        .returning();
      return { user: updated };
    },
  );

  app.delete(
    "/api/admin/users/:id",
    {
      schema: deleteAdminUsersByIdSchema,
      preHandler: [requirePlatformAdmin, requireStepUp("user:delete")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const adminUser = (req as any).user;

      if (id === adminUser.sub) {
        return reply.status(400).send({ error: "Cannot deactivate yourself" });
      }

      const [existing] = await db
        .select({ id: users.id, deactivatedAt: users.deactivatedAt })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "User not found" });

      if (existing.deactivatedAt) {
        return reply.status(400).send({ error: "User is already deactivated" });
      }

      const [updated] = await db
        .update(users)
        .set({
          deactivatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return { user: { id: updated.id, deactivatedAt: updated.deactivatedAt } };
    },
  );

  app.post(
    "/api/admin/users/:id/reactivate",
    { schema: adminUsersByIdReactivateSchema, preHandler: requirePlatformAdmin },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const [existing] = await db
        .select({ id: users.id, deactivatedAt: users.deactivatedAt })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "User not found" });
      if (!existing.deactivatedAt)
        return reply.status(400).send({ error: "User is not deactivated" });

      const [updated] = await db
        .update(users)
        .set({
          deactivatedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return { user: { id: updated.id, deactivatedAt: updated.deactivatedAt } };
    },
  );

  app.post(
    "/api/admin/users/:id/reset-password",
    {
      schema: adminUsersByIdResetPasswordSchema,
      preHandler: [requirePlatformAdmin, requireStepUp("config:update")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const [existing] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "User not found" });

      const tempPassword = crypto.randomBytes(8).toString("base64url");

      await db
        .update(users)
        .set({
          passwordHash: await argon2.hash(tempPassword),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      return { temporaryPassword: tempPassword, email: existing.email };
    },
  );

  app.get(
    "/api/admin/learners",
    { schema: getAdminLearnersSchema, preHandler: [dLearn, requireAdmin] },
    async (req) => {
      const {
        page: pageStr,
        pageSize: pageSizeStr,
        search,
        sort,
        order,
      } = req.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        sort?: string;
        order?: string;
      };
      const page = Math.max(1, parseInt(pageStr || "1") || 1);
      const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr || "50") || 50), 200);
      const offset = (page - 1) * pageSize;

      const conditions: any[] = [];
      if (search) {
        conditions.push(ilike(learners.name, `%${search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol =
        sort === "name"
          ? learners.name
          : sort === "gradeLevel"
            ? learners.gradeLevel
            : learners.createdAt;
      const sortDir = order === "asc" ? asc(sortCol) : desc(sortCol);

      const [totalResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(learners)
        .where(whereClause);

      const rows = await db
        .select({
          id: learners.id,
          name: learners.name,
          functioningLevel: learners.functioningLevel,
          gradeLevel: learners.gradeLevel,
          curriculumFramework: learners.curriculumFramework,
          parentId: learners.parentId,
          tenantId: learners.tenantId,
          createdAt: learners.createdAt,
        })
        .from(learners)
        .where(whereClause)
        .orderBy(sortDir)
        .limit(pageSize)
        .offset(offset);

      return { learners: rows, total: Number(totalResult.count), page, pageSize };
    },
  );

  app.get(
    "/api/admin/learners/:id",
    { schema: getAdminLearnersByIdSchema, preHandler: [dLearnId, requireAdmin] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const [learner] = await db.select().from(learners).where(eq(learners.id, id)).limit(1);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });

      const [parent] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, learner.parentId))
        .limit(1);

      const [sensory] = await db
        .select()
        .from(sensoryProfiles)
        .where(eq(sensoryProfiles.learnerId, id))
        .limit(1);

      let tenant = null;
      if (learner.tenantId) {
        const [t] = await db
          .select({ id: tenants.id, name: tenants.name, type: tenants.type })
          .from(tenants)
          .where(eq(tenants.id, learner.tenantId))
          .limit(1);
        tenant = t || null;
      }

      return {
        ...learner,
        parent: parent || null,
        sensoryProfile: sensory || null,
        tenant,
      };
    },
  );

  app.get(
    "/api/admin/tenants",
    { schema: getAdminTenantsSchema, preHandler: [dTen, requireAdmin] },
    async (req) => {
      const {
        page: pageStr,
        pageSize: pageSizeStr,
        search,
        sort,
        order,
      } = req.query as {
        page?: string;
        pageSize?: string;
        search?: string;
        sort?: string;
        order?: string;
      };
      const page = Math.max(1, parseInt(pageStr || "1"));
      const pageSize = Math.min(Math.max(1, parseInt(pageSizeStr || "50")), 200);
      const offset = (page - 1) * pageSize;

      const conditions: any[] = [];
      if (search) {
        conditions.push(ilike(tenants.name, `%${search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol = sort === "name" ? tenants.name : tenants.createdAt;
      const sortDir = order === "asc" ? asc(sortCol) : desc(sortCol);

      const [totalResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(tenants)
        .where(whereClause);

      const rows = await db
        .select()
        .from(tenants)
        .where(whereClause)
        .orderBy(sortDir)
        .limit(pageSize)
        .offset(offset);

      return { tenants: rows, total: Number(totalResult.count), page, pageSize };
    },
  );

  app.get(
    "/api/admin/tenants/:id",
    { schema: getAdminTenantsByIdSchema, preHandler: [dTenId, requireAdmin] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      if (!tenant) return reply.status(404).send({ error: "Tenant not found" });

      const tenantUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, id))
        .orderBy(desc(users.createdAt));

      const tenantLearners = await db
        .select({
          id: learners.id,
          name: learners.name,
          functioningLevel: learners.functioningLevel,
          gradeLevel: learners.gradeLevel,
          createdAt: learners.createdAt,
        })
        .from(learners)
        .where(eq(learners.tenantId, id))
        .orderBy(desc(learners.createdAt));

      return {
        ...tenant,
        users: tenantUsers,
        learners: tenantLearners,
        userCount: tenantUsers.length,
        learnerCount: tenantLearners.length,
      };
    },
  );

  app.put(
    "/api/admin/tenants/:id",
    {
      schema: updateAdminTenantsByIdSchema,
      preHandler: [requirePlatformAdmin, requireStepUp("tenant:suspend")],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as any;

      const [existing] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, id))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "Tenant not found" });

      const allowedFields: Record<string, any> = {};
      if (body.name !== undefined) allowedFields.name = body.name;
      if (body.settings !== undefined) allowedFields.settings = body.settings;
      if (body.status !== undefined) {
        allowedFields.status = body.status;
        if (body.status === "suspended") {
          allowedFields.suspendedAt = new Date();
          allowedFields.suspensionReason = body.suspensionReason || null;
        } else if (body.status === "active") {
          allowedFields.suspendedAt = null;
          allowedFields.suspensionReason = null;
        }
      }

      if (Object.keys(allowedFields).length === 0) {
        return reply.status(400).send({ error: "No valid fields to update" });
      }

      allowedFields.updatedAt = new Date();

      const [updated] = await db
        .update(tenants)
        .set(allowedFields)
        .where(eq(tenants.id, id))
        .returning();
      return { tenant: updated };
    },
  );

  app.post(
    "/api/admin/impersonate",
    {
      preHandler: [requirePlatformAdmin, requireStepUp("user:impersonate")],
      schema: {
        tags: ["Admin"],
        body: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = req.body as any;
      const adminUser = (req as any).user;

      if (userId === adminUser.sub) {
        return reply.status(400).send({ error: "Cannot impersonate yourself" });
      }

      const [targetUser] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({ error: "User not found" });
      }

      const startedAt = Date.now();
      const impersonatedToken = await signJWT({
        sub: targetUser.id,
        tenantId: targetUser.tenantId || "",
        role: targetUser.role,
        email: targetUser.email || "",
        name: targetUser.name,
        impersonatedBy: adminUser.sub,
        impersonationStartedAt: startedAt,
      });

      // Sprint 4: write IMPERSONATION_STARTED into the hash-chained admin
      // audit log. Failure to audit MUST block impersonation — silently
      // dropping the trail would defeat the control.
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "IMPERSONATION_STARTED",
        actorId: adminUser.sub,
        actorEmail: adminUser.email || "",
        actorRole: adminUser.role,
        onBehalfOfId: targetUser.id,
        resourceType: "user",
        resourceId: targetUser.id,
        details: { startedAt, targetEmail: targetUser.email, targetRole: targetUser.role },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
        tenantId: adminUser.tenantId || null,
      });

      return {
        accessToken: impersonatedToken,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          tenantId: targetUser.tenantId,
        },
      };
    },
  );

  /**
   * Sprint 4: end an impersonation session. Caller must present a Bearer
   * token issued by /api/admin/impersonate (i.e. the JWT carries
   * `impersonatedBy`). Writes an IMPERSONATION_ENDED audit row with the
   * session duration and returns a fresh admin token for the original
   * admin so the UI can keep working without a full re-auth.
   */
  app.post(
    "/api/admin/impersonate/end",
    { schema: adminImpersonateEndSchema },
    async (req: any, reply: any) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Missing authorization header" });
      }
      let payload: any;
      try {
        payload = await verifyJWT(auth.slice(7));
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }
      if (!payload.impersonatedBy) {
        return reply.status(400).send({ error: "Token is not an impersonation token" });
      }

      const [admin] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(eq(users.id, payload.impersonatedBy))
        .limit(1);
      if (!admin) {
        return reply.status(404).send({ error: "Original admin not found" });
      }

      const durationMs = payload.impersonationStartedAt
        ? Date.now() - payload.impersonationStartedAt
        : null;

      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "IMPERSONATION_ENDED",
        actorId: admin.id,
        actorEmail: admin.email || "",
        actorRole: admin.role,
        onBehalfOfId: payload.sub,
        resourceType: "user",
        resourceId: payload.sub,
        details: { durationMs, startedAt: payload.impersonationStartedAt ?? null },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
        tenantId: admin.tenantId || null,
      });

      const adminToken = await signJWT({
        sub: admin.id,
        tenantId: admin.tenantId || "",
        role: admin.role,
        email: admin.email || "",
        name: admin.name,
      });

      return {
        accessToken: adminToken,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          tenantId: admin.tenantId,
        },
        durationMs,
      };
    },
  );

  app.post(
    "/api/admin/create-team-member",
    {
      preHandler: requirePlatformAdmin,
      schema: {
        tags: ["Admin"],
        body: {
          type: "object",
          required: ["name", "email", "role"],
          properties: {
            name: { type: "string", minLength: 1 },
            email: { type: "string", format: "email" },
            role: {
              type: "string",
              enum: [
                "PARENT",
                "LEARNER",
                "TEACHER",
                "CAREGIVER",
                "THERAPIST",
                "PLATFORM_ADMIN",
                "SALES",
                "MARKETING",
                "CUSTOMER_CARE",
                "SUPPORT",
                "FINANCE",
                "DEVOPS",
              ],
            },
            tenantId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { name, email, role, tenantId } = req.body as any;

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        return reply.status(409).send({ error: "A user with this email already exists" });
      }

      const INTERNAL_ROLES = [
        "SALES",
        "MARKETING",
        "CUSTOMER_CARE",
        "SUPPORT",
        "FINANCE",
        "DEVOPS",
        "PLATFORM_ADMIN",
      ];
      const needsTenant = !INTERNAL_ROLES.includes(role);

      if (needsTenant && !tenantId) {
        return reply.status(400).send({ error: "tenantId is required for non-internal roles" });
      }

      if (needsTenant && tenantId) {
        const [tenant] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        if (!tenant) {
          return reply.status(400).send({ error: "Invalid tenantId — tenant not found" });
        }
      }

      const tempPassword = crypto.randomBytes(6).toString("base64url");

      const [member] = await db
        .insert(users)
        .values({
          email,
          passwordHash: await argon2.hash(tempPassword),
          name,
          role: role as any,
          ...(needsTenant && tenantId ? { tenantId } : {}),
        })
        .returning();

      return {
        user: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          tenantId: member.tenantId,
        },
        temporaryPassword: tempPassword,
      };
    },
  );

  app.post(
    "/api/admin/create-district",
    {
      preHandler: [requirePlatformAdmin, requireStepUp("district:create")],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
          keyGenerator: (request: any) => request.headers.authorization || request.ip,
        },
      },
      schema: {
        tags: ["Admin"],
        body: {
          type: "object",
          required: ["districtName", "adminName", "adminEmail"],
          properties: {
            districtName: { type: "string", minLength: 1 },
            adminName: { type: "string", minLength: 1 },
            adminEmail: { type: "string", format: "email" },
          },
        },
      },
    },
    async (req: any, reply) => {
      const { districtName, adminName, adminEmail } = req.body as {
        districtName: string;
        adminName: string;
        adminEmail: string;
      };
      const email = adminEmail.trim().toLowerCase();

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        return reply.status(409).send({ error: "A user with this email already exists" });
      }

      const [openInvite] = await db
        .select({ id: districtAdminInvites.id })
        .from(districtAdminInvites)
        .where(
          and(
            eq(districtAdminInvites.email, email),
            isNull(districtAdminInvites.acceptedAt),
            isNull(districtAdminInvites.revokedAt),
            gt(districtAdminInvites.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (openInvite) {
        return reply.status(409).send({ error: "An invite is already pending for this email." });
      }

      const [tenant] = await db
        .insert(tenants)
        .values({
          name: districtName,
          type: "B2B_DISTRICT",
          settings: { plan: "enterprise", setupComplete: false },
        })
        .returning();

      const rawToken = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
      const [invite] = await db
        .insert(districtAdminInvites)
        .values({
          tenantId: tenant.id,
          email,
          name: adminName,
          role: "DISTRICT_ADMIN",
          invitedBy: req.user.sub,
          tokenHash: hashInviteToken(rawToken),
          expiresAt,
        })
        .returning();

      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        tenantId: tenant.id,
        action: "district.created",
        actorId: req.user.sub,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        onBehalfOfId: null,
        resourceType: "tenant",
        resourceId: tenant.id,
        details: { districtName: tenant.name, email },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
      });
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        tenantId: tenant.id,
        action: "district_admin.invited",
        actorId: req.user.sub,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        onBehalfOfId: null,
        resourceType: "district_admin_invite",
        resourceId: invite.id,
        details: { districtName: tenant.name, email },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
      });
      recordDistrictInviteCreated({
        inviteId: invite.id,
        tenantId: tenant.id,
        source: "platform",
      });

      const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
      let delivery: { inviteUrl?: string };
      try {
        delivery = await sendDistrictAdminInvite({
          to: email,
          name: adminName,
          districtName: tenant.name,
          inviteUrl,
        });
      } catch (err) {
        req.log.error({ err: String(err), inviteId: invite.id }, "district invite delivery failed");
        return reply.status(502).send({
          error: "District created, but the invitation email could not be sent. Resend the invite.",
          district: { id: tenant.id, name: tenant.name, type: tenant.type },
          invite: { id: invite.id, email, expiresAt },
        });
      }

      return {
        district: {
          id: tenant.id,
          name: tenant.name,
          type: tenant.type,
          createdAt: tenant.createdAt,
        },
        invite: {
          id: invite.id,
          email,
          expiresAt,
          ...delivery,
        },
      };
    },
  );

  app.get(
    "/api/admin/district-invites",
    {
      preHandler: requirePlatformAdmin,
      schema: {
        tags: ["Admin"],
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "accepted", "expired", "revoked"] },
          },
        },
      },
    },
    async (req: any) => {
      const requestedStatus = req.query?.status as string | undefined;
      const rows = await db
        .select({
          id: districtAdminInvites.id,
          tenantId: districtAdminInvites.tenantId,
          districtName: tenants.name,
          email: districtAdminInvites.email,
          name: districtAdminInvites.name,
          role: districtAdminInvites.role,
          invitedBy: districtAdminInvites.invitedBy,
          expiresAt: districtAdminInvites.expiresAt,
          acceptedAt: districtAdminInvites.acceptedAt,
          revokedAt: districtAdminInvites.revokedAt,
          createdAt: districtAdminInvites.createdAt,
        })
        .from(districtAdminInvites)
        .innerJoin(tenants, eq(tenants.id, districtAdminInvites.tenantId))
        .where(eq(districtAdminInvites.role, "DISTRICT_ADMIN"))
        .orderBy(desc(districtAdminInvites.createdAt))
        .limit(200);
      const invites = rows.map((row: any) => ({ ...row, status: platformInviteStatus(row) }));
      return {
        invites: requestedStatus
          ? invites.filter((invite: any) => invite.status === requestedStatus)
          : invites,
      };
    },
  );

  app.post(
    "/api/admin/district-invites/:id/resend",
    { preHandler: [requirePlatformAdmin, requireStepUp("district:admin-mgmt")] },
    async (req: any, reply) => {
      const { id } = req.params as { id: string };
      const [invite] = await db
        .select({
          id: districtAdminInvites.id,
          tenantId: districtAdminInvites.tenantId,
          districtName: tenants.name,
          email: districtAdminInvites.email,
          name: districtAdminInvites.name,
          role: districtAdminInvites.role,
          expiresAt: districtAdminInvites.expiresAt,
          acceptedAt: districtAdminInvites.acceptedAt,
          revokedAt: districtAdminInvites.revokedAt,
        })
        .from(districtAdminInvites)
        .innerJoin(tenants, eq(tenants.id, districtAdminInvites.tenantId))
        .where(eq(districtAdminInvites.id, id))
        .limit(1);
      if (!invite || invite.role !== "DISTRICT_ADMIN") {
        return reply.status(404).send({ error: "Invite not found" });
      }
      if (invite.acceptedAt) return reply.status(409).send({ error: "Invite already accepted" });
      if (invite.revokedAt) return reply.status(409).send({ error: "Invite was revoked" });

      const rawToken = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
      await db
        .update(districtAdminInvites)
        .set({ tokenHash: hashInviteToken(rawToken), expiresAt })
        .where(eq(districtAdminInvites.id, id));

      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        tenantId: invite.tenantId,
        action: "district_admin.invite_resent",
        actorId: req.user.sub,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        onBehalfOfId: null,
        resourceType: "district_admin_invite",
        resourceId: id,
        details: { districtName: invite.districtName, email: invite.email },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
      });
      req.log.info(
        { inviteId: id, tenantId: invite.tenantId, action: "district_admin.invite_resent" },
        "district invite resent",
      );

      const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
      const delivery = await sendDistrictAdminInvite({
        to: invite.email,
        name: invite.name,
        districtName: invite.districtName,
        inviteUrl,
      });
      return { success: true, expiresAt, ...delivery };
    },
  );

  app.post(
    "/api/admin/district-invites/:id/revoke",
    { preHandler: [requirePlatformAdmin, requireStepUp("district:admin-mgmt")] },
    async (req: any, reply) => {
      const { id } = req.params as { id: string };
      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(eq(districtAdminInvites.id, id))
        .limit(1);
      if (!invite || invite.role !== "DISTRICT_ADMIN") {
        return reply.status(404).send({ error: "Invite not found" });
      }
      if (invite.acceptedAt) return reply.status(409).send({ error: "Invite already accepted" });
      if (invite.revokedAt) return reply.status(409).send({ error: "Invite already revoked" });

      await db
        .update(districtAdminInvites)
        .set({ revokedAt: new Date() })
        .where(eq(districtAdminInvites.id, id));
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        tenantId: invite.tenantId,
        action: "district_admin.invite_revoked",
        actorId: req.user.sub,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        onBehalfOfId: null,
        resourceType: "district_admin_invite",
        resourceId: id,
        details: { email: invite.email },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
      });
      recordDistrictInviteRevoked({
        inviteId: id,
        tenantId: invite.tenantId,
        source: "platform",
      });
      return { success: true };
    },
  );
}
