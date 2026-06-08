/**
 * Sprint 2 (district pilot) — invite parents INTO the district tenant.
 *
 * District/school admins invite parents (single + bulk CSV) as hashed-token
 * invites (role `PARENT`, pinned to the district `tenantId`, optional
 * `schoolId`), reusing the same `districtAdminInvites` table + the
 * `POST /api/auth/accept-invite` keystone. Accepted parents therefore live
 * under the DISTRICT tenant — not a self-serve B2C tenant.
 *
 * Seat cap is enforced at invite time as a friendly pre-check (active parents +
 * pending parent invites vs `tenants.seat_limit`); the hard per-learner cap
 * stays in `routes/users.ts` at learner-create. No plaintext temp passwords:
 * the parent sets their own password via accept-invite.
 *
 *   District (requireDistrictAdmin via the global /api/district/* hook):
 *     POST   /api/district/parents
 *     GET    /api/district/parents
 *     DELETE /api/district/parents/invites/:id
 *     POST   /api/district/parents/bulk
 *   School (requireSchoolAdmin preHandler, pinned to req.schoolId):
 *     POST   /api/school/parents
 *     GET    /api/school/parents
 */
import { FastifyInstance } from "fastify";
import {
  users,
  schools,
  tenants,
  districtAdminInvites,
  districtActivityLog,
  adminAuditLog,
  appendAudit,
} from "@aivo/db";
import { Permission } from "@aivo/security";
import { eq, and, count, isNull } from "drizzle-orm";
import crypto from "crypto";
import { createLogger } from "@aivo/observability";
import { requireSchoolAdmin } from "../hooks/require-school-admin.js";
import { delegatedAdminRbacV2Enabled, requestHasPermission } from "../lib/permissions.js";
import {
  recordDistrictInviteCreated,
  recordDistrictInviteRevoked,
} from "../lib/district-onboarding-observability.js";

const logger = createLogger("identity-svc.parents");
const INVITE_TTL_HOURS = 72;

const IS_PROD = process.env.NODE_ENV === "production";
const COMMS_SVC_URL = process.env.COMMS_SVC_URL || (IS_PROD ? "" : "http://localhost:3003");

function hashInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function ensureParentInvitePermission(req: any, reply: any): boolean {
  // The district hook / requireSchoolAdmin already gate the role; this adds the
  // fine-grained permission check when delegated RBAC v2 is on.
  if (!delegatedAdminRbacV2Enabled() || requestHasPermission(req.user, Permission.UserManage)) {
    return true;
  }
  reply.status(403).send({ error: "Forbidden" });
  return false;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface SeatInfo {
  seatLimit: number | null;
  committed: number;
  remaining: number | null; // null = unlimited
}

/** Friendly invite-time seat pre-check: active parents + pending parent invites. */
async function parentSeatInfo(db: any, tid: string): Promise<SeatInfo> {
  const [tenantRow] = await db
    .select({ seatLimit: tenants.seatLimit })
    .from(tenants)
    .where(eq(tenants.id, tid))
    .limit(1);
  const seatLimit = typeof tenantRow?.seatLimit === "number" ? tenantRow.seatLimit : null;

  const [{ count: parentCount }] = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.tenantId, tid), eq(users.role, "PARENT"), isNull(users.deactivatedAt)));
  const [{ count: pendingCount }] = await db
    .select({ count: count() })
    .from(districtAdminInvites)
    .where(
      and(
        eq(districtAdminInvites.tenantId, tid),
        eq(districtAdminInvites.role, "PARENT"),
        isNull(districtAdminInvites.acceptedAt),
        isNull(districtAdminInvites.revokedAt),
      ),
    );
  const committed = Number(parentCount) + Number(pendingCount);
  return {
    seatLimit,
    committed,
    remaining: seatLimit == null ? null : Math.max(0, seatLimit - committed),
  };
}

async function tenantName(db: any, tid: string): Promise<string | undefined> {
  const [t] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tid))
    .limit(1);
  return t?.name;
}

async function emailParentInvite(opts: {
  to: string;
  name: string;
  districtName?: string;
  schoolName?: string;
  inviteUrl: string;
}): Promise<void> {
  const internalKey =
    process.env.INTERNAL_SERVICE_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
  try {
    await fetch(`${COMMS_SVC_URL}/api/comms/internal/parent-invite`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify(opts),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // Fail-soft: the hashed invite row is already persisted; the admin can resend.
    logger.warn("parent invite email enqueue failed", { err: String(err) });
  }
}

async function logBoth(
  db: any,
  opts: {
    tenantId: string;
    action: string;
    actor: any;
    resourceId: string;
    details: any;
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
    resourceType: "parent_invite",
    resourceId: opts.resourceId,
    details: opts.details,
  });
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    tenantId: opts.tenantId,
    action: opts.action,
    actorId: opts.actor.sub,
    actorEmail: opts.actor.email,
    actorRole: opts.actor.role,
    onBehalfOfId: null,
    resourceType: "parent_invite",
    resourceId: opts.resourceId,
    details: opts.details,
    ipAddress: opts.ip ?? null,
    userAgent: opts.ua ?? null,
  });
}

type InviteOutcome =
  | {
      ok: true;
      invite: { id: string; email: string; name: string; schoolId: string | null; expiresAt: Date };
    }
  | { ok: false; status: number; error: string };

/**
 * Create one PARENT invite under the district tenant. Validates email, school
 * ownership, duplicate user/invite, and the seat cap. Shared by the single and
 * bulk routes (so the policy can't drift).
 */
async function createOneParentInvite(
  db: any,
  args: {
    tid: string;
    schoolId: string | null;
    email: string;
    name: string;
    actor: any;
    ip?: string;
    ua?: string;
    districtName?: string;
    schoolName?: string;
    seatGuard: boolean;
  },
): Promise<InviteOutcome> {
  const lowerEmail = args.email.trim().toLowerCase();
  const name = args.name.trim();
  if (!EMAIL_RE.test(lowerEmail)) return { ok: false, status: 400, error: "invalid_email" };
  if (!name) return { ok: false, status: 400, error: "name_required" };

  if (args.seatGuard) {
    const seats = await parentSeatInfo(db, args.tid);
    if (seats.remaining != null && seats.remaining <= 0) {
      return {
        ok: false,
        status: 409,
        error: `Seat limit reached for this pilot (${seats.seatLimit} seats). Revoke a pending invite or raise the cap.`,
      };
    }
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, args.tid), eq(users.email, lowerEmail)))
    .limit(1);
  if (existing)
    return {
      ok: false,
      status: 409,
      error: "A user with this email already exists in this district.",
    };

  const [openInvite] = await db
    .select({ id: districtAdminInvites.id })
    .from(districtAdminInvites)
    .where(
      and(
        eq(districtAdminInvites.tenantId, args.tid),
        eq(districtAdminInvites.email, lowerEmail),
        isNull(districtAdminInvites.acceptedAt),
        isNull(districtAdminInvites.revokedAt),
      ),
    )
    .limit(1);
  if (openInvite)
    return { ok: false, status: 409, error: "An invite is already pending for this email." };

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
  const [invite] = await db
    .insert(districtAdminInvites)
    .values({
      tenantId: args.tid,
      email: lowerEmail,
      name,
      role: "PARENT",
      schoolId: args.schoolId,
      invitedBy: args.actor.sub,
      tokenHash: hashInviteToken(rawToken),
      expiresAt,
    })
    .returning();

  const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
  await emailParentInvite({
    to: lowerEmail,
    name,
    districtName: args.districtName,
    schoolName: args.schoolName,
    inviteUrl,
  });
  await logBoth(db, {
    tenantId: args.tid,
    action: "parent.invited",
    actor: args.actor,
    resourceId: invite.id,
    details: { email: lowerEmail, name, schoolId: args.schoolId },
    ip: args.ip,
    ua: args.ua,
  });
  recordDistrictInviteCreated({ inviteId: invite.id, tenantId: args.tid, source: "district" });

  return {
    ok: true,
    invite: { id: invite.id, email: lowerEmail, name, schoolId: args.schoolId, expiresAt },
  };
}

/** Validate a schoolId belongs to the tenant; returns its name. */
async function resolveSchool(
  db: any,
  tid: string,
  schoolId: string,
): Promise<{ id: string; name: string } | null> {
  const [school] = await db
    .select({ id: schools.id, name: schools.name })
    .from(schools)
    .where(and(eq(schools.id, schoolId), eq(schools.tenantId, tid)))
    .limit(1);
  return school ?? null;
}

async function listParents(db: any, tid: string, schoolId?: string | null) {
  const inviteWhere = [
    eq(districtAdminInvites.tenantId, tid),
    eq(districtAdminInvites.role, "PARENT"),
  ];
  if (schoolId) inviteWhere.push(eq(districtAdminInvites.schoolId, schoolId));
  const invites = await db
    .select({
      id: districtAdminInvites.id,
      email: districtAdminInvites.email,
      name: districtAdminInvites.name,
      schoolId: districtAdminInvites.schoolId,
      expiresAt: districtAdminInvites.expiresAt,
      acceptedAt: districtAdminInvites.acceptedAt,
      revokedAt: districtAdminInvites.revokedAt,
      createdAt: districtAdminInvites.createdAt,
    })
    .from(districtAdminInvites)
    .where(and(...inviteWhere))
    .orderBy(districtAdminInvites.createdAt);

  const status = (i: any): "pending" | "accepted" | "revoked" | "expired" =>
    i.acceptedAt
      ? "accepted"
      : i.revokedAt
        ? "revoked"
        : i.expiresAt < new Date()
          ? "expired"
          : "pending";

  const seats = await parentSeatInfo(db, tid);
  return {
    parents: invites.map((i: any) => ({
      id: i.id,
      email: i.email,
      name: i.name,
      schoolId: i.schoolId,
      status: status(i),
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    })),
    seats,
  };
}

export async function registerParentRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  const inviteBodySchema = {
    type: "object",
    required: ["email", "name"],
    properties: {
      email: { type: "string" },
      name: { type: "string" },
      schoolId: { type: "string" },
    },
  } as const;

  // ── District: invite a parent ──────────────────────────────────────────────
  app.post(
    "/api/district/parents",
    { schema: { tags: ["District"], body: inviteBodySchema } },
    async (req: any, reply: any) => {
      if (!ensureParentInvitePermission(req, reply)) return;
      const tid = req.tenantId;
      const { email, name, schoolId } = (req.body || {}) as {
        email?: string;
        name?: string;
        schoolId?: string;
      };
      if (!email || !name) return reply.status(400).send({ error: "email and name are required" });

      let resolvedSchoolId: string | null = null;
      let schoolName: string | undefined;
      if (schoolId) {
        const school = await resolveSchool(db, tid, schoolId);
        if (!school)
          return reply.status(400).send({ error: "schoolId does not belong to this tenant" });
        resolvedSchoolId = school.id;
        schoolName = school.name;
      }

      const outcome = await createOneParentInvite(db, {
        tid,
        schoolId: resolvedSchoolId,
        email,
        name,
        actor: req.user,
        ip: req.ip,
        ua: req.headers["user-agent"],
        districtName: await tenantName(db, tid),
        schoolName,
        seatGuard: true,
      });
      if (!outcome.ok) return reply.status(outcome.status).send({ error: outcome.error });
      return { invite: outcome.invite };
    },
  );

  // ── District: list parents (pending + accepted) + seat usage ───────────────
  app.get(
    "/api/district/parents",
    { schema: { tags: ["District"] } },
    async (req: any, reply: any) => {
      if (!ensureParentInvitePermission(req, reply)) return;
      return listParents(db, req.tenantId);
    },
  );

  // ── District: revoke a pending parent invite ───────────────────────────────
  app.delete(
    "/api/district/parents/invites/:id",
    { schema: { tags: ["District"] } },
    async (req: any, reply: any) => {
      if (!ensureParentInvitePermission(req, reply)) return;
      const tid = req.tenantId;
      const { id } = req.params as { id: string };
      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(
          and(
            eq(districtAdminInvites.id, id),
            eq(districtAdminInvites.tenantId, tid),
            eq(districtAdminInvites.role, "PARENT"),
          ),
        )
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
        action: "parent.invite_revoked",
        actor: req.user,
        resourceId: id,
        details: { email: invite.email },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      recordDistrictInviteRevoked({ inviteId: id, tenantId: tid, source: "district" });
      return { success: true };
    },
  );

  // ── District: resend a pending parent invite (rotates the token) ───────────
  app.post(
    "/api/district/parents/invites/:id/resend",
    { schema: { tags: ["District"] } },
    async (req: any, reply: any) => {
      if (!ensureParentInvitePermission(req, reply)) return;
      const tid = req.tenantId;
      const { id } = req.params as { id: string };
      const [invite] = await db
        .select()
        .from(districtAdminInvites)
        .where(
          and(
            eq(districtAdminInvites.id, id),
            eq(districtAdminInvites.tenantId, tid),
            eq(districtAdminInvites.role, "PARENT"),
          ),
        )
        .limit(1);
      if (!invite) return reply.status(404).send({ error: "Invite not found" });
      if (invite.acceptedAt) return reply.status(400).send({ error: "Invite already accepted" });
      if (invite.revokedAt) return reply.status(400).send({ error: "Invite was revoked" });

      const rawToken = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
      await db
        .update(districtAdminInvites)
        .set({ tokenHash: hashInviteToken(rawToken), expiresAt })
        .where(eq(districtAdminInvites.id, id));

      let schoolName: string | undefined;
      if (invite.schoolId) {
        const school = await resolveSchool(db, tid, invite.schoolId);
        schoolName = school?.name;
      }
      const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
      await emailParentInvite({
        to: invite.email,
        name: invite.name,
        districtName: await tenantName(db, tid),
        schoolName,
        inviteUrl,
      });
      await logBoth(db, {
        tenantId: tid,
        action: "parent.invite_resent",
        actor: req.user,
        resourceId: id,
        details: { email: invite.email },
        ip: req.ip,
        ua: req.headers["user-agent"],
      });
      return { success: true, expiresAt };
    },
  );

  // ── District: bulk invite from CSV rows (name,email) ───────────────────────
  app.post(
    "/api/district/parents/bulk",
    { schema: { tags: ["District"] } },
    async (req: any, reply: any) => {
      if (!ensureParentInvitePermission(req, reply)) return;
      const tid = req.tenantId;
      const body = (req.body || {}) as {
        parents?: Array<{ name?: string; email?: string }>;
        csv?: string;
      };

      const rows: Array<{ name: string; email: string }> = [];
      if (Array.isArray(body.parents)) {
        for (const p of body.parents)
          rows.push({ name: String(p?.name ?? ""), email: String(p?.email ?? "") });
      } else if (typeof body.csv === "string") {
        for (const line of body.csv.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const [name, email] = trimmed.split(",").map((s) => s.trim());
          // Skip an obvious header row.
          if (name?.toLowerCase() === "name" && email?.toLowerCase() === "email") continue;
          rows.push({ name: name ?? "", email: email ?? "" });
        }
      }
      if (rows.length === 0)
        return reply.status(400).send({ error: "No rows. Send { parents: [...] } or { csv }." });
      if (rows.length > 500)
        return reply.status(400).send({ error: "Too many rows (max 500 per bulk invite)." });

      const districtName = await tenantName(db, tid);
      const seen = new Set<string>();
      const results: Array<{
        email: string;
        name: string;
        status: "invited" | "skipped" | "error";
        reason?: string;
      }> = [];

      for (const row of rows) {
        const email = row.email.trim().toLowerCase();
        if (seen.has(email)) {
          results.push({ email, name: row.name, status: "skipped", reason: "duplicate_in_batch" });
          continue;
        }
        seen.add(email);
        // Re-check the seat cap per row so a batch can't exceed the cap.
        const outcome = await createOneParentInvite(db, {
          tid,
          schoolId: null,
          email,
          name: row.name,
          actor: req.user,
          ip: req.ip,
          ua: req.headers["user-agent"],
          districtName,
          seatGuard: true,
        });
        if (outcome.ok) {
          results.push({ email, name: row.name, status: "invited" });
        } else {
          results.push({
            email,
            name: row.name,
            status: outcome.status === 409 ? "skipped" : "error",
            reason: outcome.error,
          });
        }
      }

      const invited = results.filter((r) => r.status === "invited").length;
      return { invited, total: rows.length, results, seats: await parentSeatInfo(db, tid) };
    },
  );

  // ── School: invite a parent (pinned to the admin's school) ─────────────────
  app.post(
    "/api/school/parents",
    { preHandler: requireSchoolAdmin, schema: { tags: ["School"], body: inviteBodySchema } },
    async (req: any, reply: any) => {
      const tid = req.tenantId;
      const sid = req.schoolId as string | undefined;
      if (!sid) return reply.status(400).send({ error: "No school context" });
      const { email, name } = (req.body || {}) as { email?: string; name?: string };
      if (!email || !name) return reply.status(400).send({ error: "email and name are required" });

      const school = await resolveSchool(db, tid, sid);
      if (!school) return reply.status(400).send({ error: "school not found in tenant" });

      const outcome = await createOneParentInvite(db, {
        tid,
        schoolId: sid,
        email,
        name,
        actor: req.user,
        ip: req.ip,
        ua: req.headers["user-agent"],
        districtName: await tenantName(db, tid),
        schoolName: school.name,
        seatGuard: true,
      });
      if (!outcome.ok) return reply.status(outcome.status).send({ error: outcome.error });
      return { invite: outcome.invite };
    },
  );

  // ── School: list parents for this school ───────────────────────────────────
  app.get(
    "/api/school/parents",
    { preHandler: requireSchoolAdmin, schema: { tags: ["School"] } },
    async (req: any) => {
      return listParents(db, req.tenantId, req.schoolId as string | undefined);
    },
  );
}
