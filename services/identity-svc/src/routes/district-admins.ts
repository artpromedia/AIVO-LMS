/**
 * Sprint 8: delegated district admin management.
 *
 * Endpoints under /api/district/admins let a DISTRICT_ADMIN (or
 * PLATFORM_ADMIN impersonating one) manage peer admins in their tenant
 * without involving Replit/AIVO support. Every mutation requires a
 * valid step-up token (`scope: district:admin-mgmt`) and is dual-logged
 * to district_activity_log + admin_audit_log.
 *
 * Guardrails:
 *  - Role on these endpoints is always pinned to DISTRICT_ADMIN — it
 *    cannot be elevated.
 *  - The last active DISTRICT_ADMIN in a tenant cannot be deactivated.
 *  - All work is tenant-scoped via req.tenantId injected by the global
 *    onRequest hook (see hooks/require-district-admin.ts).
 */
import { FastifyInstance } from "fastify";
import {
  users,
  schools,
  districtAdminInvites,
  districtSettings,
  districtActivityLog,
  appendAudit,
  adminAuditLog,
} from "@aivo/db";
import { Permission } from "@aivo/security";
import { eq, and, count, isNull, ne, inArray } from "drizzle-orm";
import argon2 from "argon2";
import crypto from "crypto";
import { createLogger } from "@aivo/observability";
import { requireStepUp } from "./step-up.js";
import { delegatedAdminRbacV2Enabled, requestHasPermission } from "../lib/permissions.js";
import {
  getDistrictAdminsSchema,
  districtAdminsSchema,
  districtAdminsInvitesByIdResendSchema,
  deleteDistrictAdminsInvitesByIdSchema,
  districtAdminsByIdDeactivateSchema,
  districtAdminsByIdReactivateSchema,
  districtAdminsByIdResetPasswordSchema,
  getDistrictAdminsMfaStatsSchema,
  updateDistrictAdminsForceMfaSchema,
} from "./schemas.js";

const logger = createLogger("identity-svc.district-admins");

const INVITE_TTL_HOURS = 72;
const STEP_UP_SCOPE = "district:admin-mgmt" as const;

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

function ensureDistrictAdminPermission(req: any, reply: any, permission: Permission): boolean {
  if (
    !delegatedAdminRbacV2Enabled() ||
    requestHasPermission(req.user, permission)
  ) {
    return true;
  }
  reply.status(403).send({ error: "Forbidden" });
  return false;
}

async function logBoth(
  db: any,
  opts: {
    tenantId: string;
    action: string;
    actor: any;
    resourceType: string;
    resourceId?: string;
    details?: any;
    ip?: string;
    ua?: string;
  },
) {
  await appendAudit(db, "district_activity_log", districtActivityLog, {
    tenantId: opts.tenantId,
    action: opts.action,
    actorId: opts.actor.sub,
    actorName: opts.actor.name || opts.actor.email,
    onBehalfOfId: null,
    resourceType: opts.resourceType,
    resourceId: opts.resourceId ?? null,
    details: opts.details ?? null,
  });
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    tenantId: opts.tenantId,
    action: opts.action,
    actorId: opts.actor.sub,
    actorEmail: opts.actor.email,
    actorRole: opts.actor.role,
    onBehalfOfId: null,
    resourceType: opts.resourceType,
    resourceId: opts.resourceId ?? null,
    details: opts.details ?? null,
    ipAddress: opts.ip ?? null,
    userAgent: opts.ua ?? null,
  });
}

async function emailInvite(opts: {
  to: string;
  name: string;
  districtName?: string;
  schoolName?: string;
  inviteUrl: string;
  role: "DISTRICT_ADMIN" | "SCHOOL_ADMIN";
}) {
  const internalKey = process.env.INTERNAL_SERVICE_KEY || "";
  const path =
    opts.role === "SCHOOL_ADMIN"
      ? "/api/comms/internal/school-admin-invite"
      : "/api/comms/internal/district-admin-invite";
  try {
    await fetch(`${COMMS_SVC_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({
        to: opts.to,
        name: opts.name,
        districtName: opts.districtName,
        schoolName: opts.schoolName,
        inviteUrl: opts.inviteUrl,
      }),
    });
  } catch (err) {
    // Fail-soft: invite row is already persisted, the admin can resend
    // if email delivery hiccups.
    logger.warn("invite email enqueue failed", { err: String(err) });
  }
}

export async function registerDistrictAdminRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  // Convenience helpers — both the global tenant-scope hook and these
  // per-route preHandlers run, but the hook is idempotent.
  const stepUp = requireStepUp(STEP_UP_SCOPE);

  // --- LIST --------------------------------------------------------
  // Returns both DISTRICT_ADMIN and SCHOOL_ADMIN users + their pending
  // invites. School admins carry a schoolId/schoolName so the UI can
  // group them under the school they oversee.
  app.get("/api/district/admins", { schema: getDistrictAdminsSchema }, async (req: any, reply: any) => {
    if (!ensureDistrictAdminPermission(req, reply, Permission.UserRead)) return;
    const tid = req.tenantId;
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        schoolId: users.schoolId,
        mfaEnabled: users.mfaEnabled,
        deactivatedAt: users.deactivatedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tid),
          inArray(users.role as any, ["DISTRICT_ADMIN", "SCHOOL_ADMIN"] as readonly string[]),
        ),
      )
      .orderBy(users.createdAt);

    const pendingInvites = await db
      .select({
        id: districtAdminInvites.id,
        email: districtAdminInvites.email,
        name: districtAdminInvites.name,
        role: districtAdminInvites.role,
        schoolId: districtAdminInvites.schoolId,
        expiresAt: districtAdminInvites.expiresAt,
        createdAt: districtAdminInvites.createdAt,
        invitedBy: districtAdminInvites.invitedBy,
      })
      .from(districtAdminInvites)
      .where(
        and(
          eq(districtAdminInvites.tenantId, tid),
          isNull(districtAdminInvites.acceptedAt),
          isNull(districtAdminInvites.revokedAt),
        ),
      )
      .orderBy(districtAdminInvites.createdAt);

    // Resolve schoolName for any school-scoped admins/invites in a single query.
    const schoolIds = new Set<string>();
    for (const r of rows) if (r.schoolId) schoolIds.add(r.schoolId);
    for (const i of pendingInvites) if (i.schoolId) schoolIds.add(i.schoolId);
    const schoolNameById = new Map<string, string>();
    if (schoolIds.size > 0) {
      const schoolRows = await db
        .select({ id: schools.id, name: schools.name })
        .from(schools)
        .where(and(eq(schools.tenantId, tid), inArray(schools.id, Array.from(schoolIds))));
      for (const s of schoolRows) schoolNameById.set(s.id, s.name);
    }

    return {
      admins: rows.map((r: any) => ({
        ...r,
        schoolName: r.schoolId ? (schoolNameById.get(r.schoolId) ?? null) : null,
      })),
      pendingInvites: pendingInvites.map((i: any) => ({
        ...i,
        schoolName: i.schoolId ? (schoolNameById.get(i.schoolId) ?? null) : null,
      })),
    };
  });

  // --- INVITE ------------------------------------------------------
  // Provisions either a DISTRICT_ADMIN (district-wide, default) or a
  // SCHOOL_ADMIN (scoped to a single school in this tenant). When
  // role = SCHOOL_ADMIN, `schoolId` is required and is validated to
  // belong to the caller's tenant.
  app.post(
    "/api/district/admins",
    { schema: districtAdminsSchema, preHandler: stepUp },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.UserManage)) return;
      const tid = req.tenantId;
      const {
        email,
        name,
        role: rawRole,
        schoolId,
      } = (req.body || {}) as {
        email?: string;
        name?: string;
        role?: string;
        schoolId?: string;
      };
      if (!email || !name) {
        return reply.status(400).send({ error: "email and name are required" });
      }
      const role = (rawRole || "DISTRICT_ADMIN").toUpperCase();
      if (role !== "DISTRICT_ADMIN" && role !== "SCHOOL_ADMIN") {
        return reply.status(400).send({ error: "role must be DISTRICT_ADMIN or SCHOOL_ADMIN" });
      }

      let resolvedSchoolId: string | null = null;
      let schoolName: string | undefined;
      if (role === "SCHOOL_ADMIN") {
        if (!schoolId) {
          return reply.status(400).send({ error: "schoolId is required for SCHOOL_ADMIN invites" });
        }
        const [school] = await db
          .select({ id: schools.id, name: schools.name })
          .from(schools)
          .where(and(eq(schools.id, schoolId), eq(schools.tenantId, tid)))
          .limit(1);
        if (!school) {
          return reply.status(400).send({ error: "schoolId does not belong to this tenant" });
        }
        resolvedSchoolId = school.id;
        schoolName = school.name;
      }

      const lowerEmail = email.trim().toLowerCase();

      // Reject if a user with this email already exists in this tenant.
      const [existing] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.tenantId, tid), eq(users.email, lowerEmail)))
        .limit(1);
      if (existing) {
        return reply
          .status(409)
          .send({ error: "A user with this email already exists in your district." });
      }

      // Reject if there's an outstanding invite.
      const [openInvite] = await db
        .select({ id: districtAdminInvites.id })
        .from(districtAdminInvites)
        .where(
          and(
            eq(districtAdminInvites.tenantId, tid),
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
          tenantId: tid,
          email: lowerEmail,
          name,
          role,
          schoolId: resolvedSchoolId,
          invitedBy: req.user.sub,
          tokenHash,
          expiresAt,
        })
        .returning();

      const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
      await emailInvite({
        to: lowerEmail,
        name,
        role: role as "DISTRICT_ADMIN" | "SCHOOL_ADMIN",
        schoolName,
        inviteUrl,
      });

      await logBoth(db, {
        tenantId: tid,
        action: role === "SCHOOL_ADMIN" ? "school_admin.invited" : "district_admin.invited",
        actor: req.user,
        resourceType: "district_admin_invite",
        resourceId: invite.id,
        details: { email: lowerEmail, name, role, schoolId: resolvedSchoolId },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });

      return {
        invite: {
          id: invite.id,
          email: lowerEmail,
          name,
          role,
          schoolId: resolvedSchoolId,
          expiresAt,
        },
      };
    },
  );

  // --- RESEND INVITE ----------------------------------------------
  app.post(
    "/api/district/admins/invites/:id/resend",
    { schema: districtAdminsInvitesByIdResendSchema, preHandler: stepUp },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.UserManage)) return;
      const tid = req.tenantId;
      const { id } = req.params as { id: string };
      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(and(eq(districtAdminInvites.id, id), eq(districtAdminInvites.tenantId, tid)))
        .limit(1);
      if (!invite) return reply.status(404).send({ error: "Invite not found" });
      if (invite.acceptedAt) return reply.status(400).send({ error: "Invite already accepted" });
      if (invite.revokedAt) return reply.status(400).send({ error: "Invite was revoked" });

      // Rotate the token on resend so the previous email link is dead.
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashInviteToken(rawToken);
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
      await db
        .update(districtAdminInvites)
        .set({ tokenHash, expiresAt })
        .where(eq(districtAdminInvites.id, id));

      const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
      let schoolName: string | undefined;
      if (invite.schoolId) {
        const [school] = await db
          .select({ name: schools.name })
          .from(schools)
          .where(and(eq(schools.id, invite.schoolId), eq(schools.tenantId, tid)))
          .limit(1);
        schoolName = school?.name;
      }
      await emailInvite({
        to: invite.email,
        name: invite.name,
        role: (invite.role || "DISTRICT_ADMIN") as "DISTRICT_ADMIN" | "SCHOOL_ADMIN",
        schoolName,
        inviteUrl,
      });

      await logBoth(db, {
        tenantId: tid,
        action:
          invite.role === "SCHOOL_ADMIN"
            ? "school_admin.invite_resent"
            : "district_admin.invite_resent",
        actor: req.user,
        resourceType: "district_admin_invite",
        resourceId: id,
        details: { email: invite.email },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      return { success: true, expiresAt };
    },
  );

  // --- REVOKE INVITE ----------------------------------------------
  app.delete(
    "/api/district/admins/invites/:id",
    { schema: deleteDistrictAdminsInvitesByIdSchema, preHandler: stepUp },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.UserManage)) return;
      const tid = req.tenantId;
      const { id } = req.params as { id: string };
      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(and(eq(districtAdminInvites.id, id), eq(districtAdminInvites.tenantId, tid)))
        .limit(1);
      if (!invite) return reply.status(404).send({ error: "Invite not found" });
      if (invite.acceptedAt)
        return reply.status(400).send({ error: "Cannot revoke an accepted invite" });

      await db
        .update(districtAdminInvites)
        .set({ revokedAt: new Date() })
        .where(eq(districtAdminInvites.id, id));

      await logBoth(db, {
        tenantId: tid,
        action: "district_admin.invite_revoked",
        actor: req.user,
        resourceType: "district_admin_invite",
        resourceId: id,
        details: { email: invite.email },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      return { success: true };
    },
  );

  // --- DEACTIVATE --------------------------------------------------
  app.post(
    "/api/district/admins/:id/deactivate",
    { schema: districtAdminsByIdDeactivateSchema, preHandler: stepUp },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.UserManage)) return;
      const tid = req.tenantId;
      const { id } = req.params as { id: string };
      const [target] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.tenantId, tid),
            inArray(users.role as any, ["DISTRICT_ADMIN", "SCHOOL_ADMIN"] as readonly string[]),
          ),
        )
        .limit(1);
      if (!target) return reply.status(404).send({ error: "Admin not found" });
      if (target.deactivatedAt)
        return reply.status(400).send({ error: "Admin already deactivated" });

      // Block deactivating the last active district admin in the tenant —
      // school admins are not load-bearing the way district admins are.
      if (target.role === "DISTRICT_ADMIN") {
        const [{ count: activeCount }] = await db
          .select({ count: count() })
          .from(users)
          .where(
            and(
              eq(users.tenantId, tid),
              eq(users.role, "DISTRICT_ADMIN"),
              isNull(users.deactivatedAt),
              ne(users.id, id),
            ),
          );
        if (Number(activeCount) === 0) {
          return reply.status(400).send({
            error:
              "Cannot deactivate the last active district administrator. Promote another admin first.",
          });
        }
      }

      await db
        .update(users)
        .set({
          deactivatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      await logBoth(db, {
        tenantId: tid,
        action:
          target.role === "SCHOOL_ADMIN"
            ? "school_admin.deactivated"
            : "district_admin.deactivated",
        actor: req.user,
        resourceType: "user",
        resourceId: id,
        details: { email: target.email, role: target.role, schoolId: target.schoolId },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      return { success: true };
    },
  );

  // --- REACTIVATE --------------------------------------------------
  app.post(
    "/api/district/admins/:id/reactivate",
    { schema: districtAdminsByIdReactivateSchema, preHandler: stepUp },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.UserManage)) return;
      const tid = req.tenantId;
      const { id } = req.params as { id: string };
      const [target] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.tenantId, tid),
            inArray(users.role as any, ["DISTRICT_ADMIN", "SCHOOL_ADMIN"] as readonly string[]),
          ),
        )
        .limit(1);
      if (!target) return reply.status(404).send({ error: "Admin not found" });
      if (!target.deactivatedAt)
        return reply.status(400).send({ error: "Admin is already active" });

      await db
        .update(users)
        .set({
          deactivatedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));

      await logBoth(db, {
        tenantId: tid,
        action:
          target.role === "SCHOOL_ADMIN"
            ? "school_admin.reactivated"
            : "district_admin.reactivated",
        actor: req.user,
        resourceType: "user",
        resourceId: id,
        details: { email: target.email, role: target.role, schoolId: target.schoolId },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      return { success: true };
    },
  );

  // --- RESET PASSWORD ---------------------------------------------
  // Generates a temporary password, returns it once, and forces a
  // change on next login. Caller should display it inside the step-up
  // confirmation modal and instruct the admin to share it out-of-band.
  app.post(
    "/api/district/admins/:id/reset-password",
    { schema: districtAdminsByIdResetPasswordSchema, preHandler: stepUp },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.UserManage)) return;
      const tid = req.tenantId;
      const { id } = req.params as { id: string };
      const [target] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.tenantId, tid),
            inArray(users.role as any, ["DISTRICT_ADMIN", "SCHOOL_ADMIN"] as readonly string[]),
          ),
        )
        .limit(1);
      if (!target) return reply.status(404).send({ error: "Admin not found" });

      // Cryptographically random temporary password — ≥ 16 chars, mixed
      // alphabet ensures it satisfies the password policy without
      // re-running policy here (entropy >> threshold).
      const tempPassword = crypto.randomBytes(15).toString("base64url");
      const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

      await db
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, id));

      await logBoth(db, {
        tenantId: tid,
        action:
          target.role === "SCHOOL_ADMIN"
            ? "school_admin.password_reset"
            : "district_admin.password_reset",
        actor: req.user,
        resourceType: "user",
        resourceId: id,
        details: { email: target.email, role: target.role, schoolId: target.schoolId },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      return { success: true, tempPassword, mustChangePassword: true };
    },
  );

  // --- MFA ADOPTION STATS -----------------------------------------
  // Counts active staff in this tenant (district admins + teachers +
  // therapists + caregivers), how many have MFA enrolled, and whether
  // the tenant-level forceMfa override is on. Powers the widget on the
  // district settings page.
  app.get(
    "/api/district/admins/mfa-stats",
    { schema: getDistrictAdminsMfaStatsSchema },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.DistrictRead)) return;
      const tid = req.tenantId;
      const STAFF_ROLES = [
        "DISTRICT_ADMIN",
        "SCHOOL_ADMIN",
        "TEACHER",
        "THERAPIST",
        "CAREGIVER",
      ] as const;
      const ADMIN_ROLES = ["DISTRICT_ADMIN", "SCHOOL_ADMIN"] as const;

      const [staffTotal] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tid),
            isNull(users.deactivatedAt),
            inArray(users.role as any, STAFF_ROLES as readonly string[]),
          ),
        );
      const [withMfa] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tid),
            isNull(users.deactivatedAt),
            inArray(users.role as any, STAFF_ROLES as readonly string[]),
            eq(users.mfaEnabled, true),
          ),
        );
      const [adminTotal] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tid),
            isNull(users.deactivatedAt),
            inArray(users.role as any, ADMIN_ROLES as readonly string[]),
          ),
        );
      const [adminMfa] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tid),
            isNull(users.deactivatedAt),
            inArray(users.role as any, ADMIN_ROLES as readonly string[]),
            eq(users.mfaEnabled, true),
          ),
        );

      const [settings] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, tid))
        .limit(1);
      const overrides = (settings?.featureOverrides || {}) as any;

      return {
        staff: { total: Number(staffTotal.count), withMfa: Number(withMfa.count) },
        admins: { total: Number(adminTotal.count), withMfa: Number(adminMfa.count) },
        forceMfa: !!overrides.forceMfa,
      };
    },
  );

  // --- TOGGLE FORCE-MFA -------------------------------------------
  app.put(
    "/api/district/admins/force-mfa",
    { schema: updateDistrictAdminsForceMfaSchema, preHandler: stepUp },
    async (req: any, reply: any) => {
      if (!ensureDistrictAdminPermission(req, reply, Permission.UserManage)) return;
      const tid = req.tenantId;
      const { enabled } = (req.body || {}) as { enabled?: boolean };
      if (typeof enabled !== "boolean") {
        return reply.status(400).send({ error: "enabled must be a boolean" });
      }
      const [settings] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, tid))
        .limit(1);
      const overrides = { ...(settings?.featureOverrides || ({} as any)), forceMfa: enabled };
      if (settings) {
        await db
          .update(districtSettings)
          .set({
            featureOverrides: overrides,
            updatedAt: new Date(),
          })
          .where(eq(districtSettings.tenantId, tid));
      } else {
        await db.insert(districtSettings).values({ tenantId: tid, featureOverrides: overrides });
      }
      await logBoth(db, {
        tenantId: tid,
        action: "district_admin.force_mfa_toggled",
        actor: req.user,
        resourceType: "district_settings",
        resourceId: tid,
        details: { enabled },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      return { success: true, forceMfa: enabled };
    },
  );
}
