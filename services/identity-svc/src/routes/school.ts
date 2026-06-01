/**
 * Sprint 1 (invite-flows): school-admin teacher management.
 *
 * Endpoints under /api/school/* let a SCHOOL_ADMIN (or a DISTRICT_ADMIN /
 * PLATFORM_ADMIN acting on a school) invite and manage teachers within a
 * single school. Scope is enforced by `requireSchoolAdmin`, which injects
 * `req.tenantId`, `req.schoolId`, and `req.user`:
 *   - SCHOOL_ADMIN   → schoolId is pinned from their JWT.
 *   - DISTRICT_ADMIN → schoolId comes from the request and is verified here
 *                      to belong to the caller's tenant.
 *
 * Teacher invites reuse the token-hashed `district_admin_invites` table
 * (role = TEACHER) and the production `/api/auth/accept-invite` acceptance
 * flow, so an invited teacher sets their own password — no out-of-band
 * temporary passwords.
 */
import { FastifyInstance } from "fastify";
import {
  users,
  schools,
  districtAdminInvites,
  appendAudit,
  adminAuditLog,
} from "@aivo/db";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";
import { createLogger } from "@aivo/observability";
import { requireSchoolAdmin } from "../hooks/require-school-admin.js";

const logger = createLogger("identity-svc.school");

const INVITE_TTL_HOURS = 72;

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`identity-svc: ${name} must be set in production`);
  return devDefault;
}
const COMMS_SVC_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3003");

function hashInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function emailTeacherInvite(opts: {
  to: string;
  name: string;
  schoolName?: string;
  inviteUrl: string;
}) {
  const internalKey = process.env.INTERNAL_SERVICE_KEY || "";
  try {
    await fetch(`${COMMS_SVC_URL}/api/comms/internal/teacher-invite`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({
        to: opts.to,
        name: opts.name,
        schoolName: opts.schoolName,
        inviteUrl: opts.inviteUrl,
      }),
    });
  } catch (err) {
    // Fail-soft: the invite row is already persisted; the admin can resend.
    logger.warn("teacher invite email enqueue failed", { err: String(err) });
  }
}

export async function registerSchoolRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  // Resolve + verify the target school for this request. SCHOOL_ADMIN tokens
  // pin schoolId; DISTRICT/PLATFORM admins pass it and we confirm ownership.
  async function resolveSchool(req: any, reply: any): Promise<{ id: string; name: string } | null> {
    const sid = req.schoolId as string | undefined;
    if (!sid) {
      reply.status(400).send({ error: "schoolId is required" });
      return null;
    }
    // PLATFORM_ADMIN may target any school; everyone else is tenant-scoped.
    const where =
      req.user?.role === "PLATFORM_ADMIN"
        ? eq(schools.id, sid)
        : and(eq(schools.id, sid), eq(schools.tenantId, req.tenantId));
    const [school] = await db.select({ id: schools.id, name: schools.name }).from(schools).where(where).limit(1);
    if (!school) {
      reply.status(404).send({ error: "School not found in your scope" });
      return null;
    }
    return school;
  }

  // --- LIST teachers + pending teacher invites for the school -------
  app.get("/api/school/teachers", { preHandler: requireSchoolAdmin }, async (req: any, reply: any) => {
    const school = await resolveSchool(req, reply);
    if (!school) return;

    const teachers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        deactivatedAt: users.deactivatedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.schoolId, school.id), eq(users.role, "TEACHER")))
      .orderBy(users.createdAt);

    const pendingInvites = await db
      .select({
        id: districtAdminInvites.id,
        email: districtAdminInvites.email,
        name: districtAdminInvites.name,
        expiresAt: districtAdminInvites.expiresAt,
        createdAt: districtAdminInvites.createdAt,
      })
      .from(districtAdminInvites)
      .where(
        and(
          eq(districtAdminInvites.schoolId, school.id),
          eq(districtAdminInvites.role, "TEACHER"),
          isNull(districtAdminInvites.acceptedAt),
          isNull(districtAdminInvites.revokedAt),
        ),
      )
      .orderBy(districtAdminInvites.createdAt);

    return { school: { id: school.id, name: school.name }, teachers, pendingInvites };
  });

  // --- INVITE a teacher --------------------------------------------
  app.post("/api/school/teachers", { preHandler: requireSchoolAdmin }, async (req: any, reply: any) => {
    const school = await resolveSchool(req, reply);
    if (!school) return;

    const { email, name } = (req.body || {}) as { email?: string; name?: string };
    const lowerEmail = (email || "").trim().toLowerCase();
    const displayName = (name || "").trim();
    if (!EMAIL_RE.test(lowerEmail)) {
      return reply.status(400).send({ error: "A valid email is required" });
    }
    if (!displayName) {
      return reply.status(400).send({ error: "name is required" });
    }

    // Reject if a user with this email already exists in the tenant.
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, req.tenantId), eq(users.email, lowerEmail)))
      .limit(1);
    if (existing) {
      return reply.status(409).send({ error: "A user with this email already exists in your district." });
    }

    // Reject if there's an outstanding invite for this email.
    const [openInvite] = await db
      .select({ id: districtAdminInvites.id })
      .from(districtAdminInvites)
      .where(
        and(
          eq(districtAdminInvites.tenantId, req.tenantId),
          eq(districtAdminInvites.email, lowerEmail),
          isNull(districtAdminInvites.acceptedAt),
          isNull(districtAdminInvites.revokedAt),
        ),
      )
      .limit(1);
    if (openInvite) {
      return reply.status(409).send({ error: "An invite is already pending for this email." });
    }

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashInviteToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);

    const [invite] = await db
      .insert(districtAdminInvites)
      .values({
        tenantId: req.tenantId,
        email: lowerEmail,
        name: displayName,
        role: "TEACHER",
        schoolId: school.id,
        invitedBy: req.user.sub,
        tokenHash,
        expiresAt,
      })
      .returning();

    const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
    await emailTeacherInvite({ to: lowerEmail, name: displayName, schoolName: school.name, inviteUrl });

    try {
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        tenantId: req.tenantId,
        action: "teacher.invited",
        actorId: req.user.sub,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        onBehalfOfId: null,
        resourceType: "district_admin_invite",
        resourceId: invite.id,
        details: { email: lowerEmail, name: displayName, schoolId: school.id },
        ipAddress: req.ip ?? null,
        userAgent: (req.headers["user-agent"] as string) ?? null,
      });
    } catch (err) {
      logger.warn("teacher invite audit append failed", { err: String(err) });
    }

    return {
      invite: {
        id: invite.id,
        email: lowerEmail,
        name: displayName,
        role: "TEACHER",
        schoolId: school.id,
        expiresAt,
      },
    };
  });

  // --- REVOKE a pending teacher invite -----------------------------
  app.delete(
    "/api/school/teachers/invites/:id",
    { preHandler: requireSchoolAdmin },
    async (req: any, reply: any) => {
      const school = await resolveSchool(req, reply);
      if (!school) return;
      const { id } = req.params as { id: string };

      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(
          and(
            eq(districtAdminInvites.id, id),
            eq(districtAdminInvites.schoolId, school.id),
            eq(districtAdminInvites.role, "TEACHER"),
          ),
        )
        .limit(1);
      if (!invite) return reply.status(404).send({ error: "Invite not found" });
      if (invite.acceptedAt) {
        return reply.status(400).send({ error: "Cannot revoke an accepted invite" });
      }

      await db
        .update(districtAdminInvites)
        .set({ revokedAt: new Date() })
        .where(eq(districtAdminInvites.id, id));

      try {
        await appendAudit(db, "admin_audit_log", adminAuditLog, {
          tenantId: req.tenantId,
          action: "teacher.invite_revoked",
          actorId: req.user.sub,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          onBehalfOfId: null,
          resourceType: "district_admin_invite",
          resourceId: id,
          details: { email: invite.email, schoolId: school.id },
          ipAddress: req.ip ?? null,
          userAgent: (req.headers["user-agent"] as string) ?? null,
        });
      } catch (err) {
        logger.warn("teacher invite revoke audit append failed", { err: String(err) });
      }

      return { success: true };
    },
  );
}
