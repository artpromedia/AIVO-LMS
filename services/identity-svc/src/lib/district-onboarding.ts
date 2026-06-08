/**
 * Shared district-onboarding primitives.
 *
 * Extracted from the `POST /api/admin/create-district` route so the new
 * pilot-provisioning orchestration (`POST /api/admin/pilots`) reuses the exact
 * same tenant-creation, hashed-invite, audit, and comms-delivery logic — no
 * copy-paste drift. The original route is a thin caller of these helpers.
 *
 * Onboarding never creates or returns a temporary password: the first admin
 * always arrives via the hashed single-use invite + accept-invite flow.
 */
import crypto from "crypto";
import { tenants, districtAdminInvites, adminAuditLog, appendAudit } from "@aivo/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { recordDistrictInviteCreated } from "./district-onboarding-observability.js";

export const INVITE_TTL_HOURS = 72;
const COMMS_SVC_URL = process.env.COMMS_SVC_URL || "http://localhost:3003";

export function hashInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Actor (platform admin) attribution stamped on audit rows. */
export interface OnboardingActor {
  sub: string;
  email?: string | null;
  role?: string | null;
}

/** Raised when the invite is persisted but comms delivery fails, carrying the
 *  partial result so the caller can surface a "resend the invite" 502. */
export class DistrictInviteDeliveryError extends Error {
  constructor(
    public readonly tenant: { id: string; name: string; type: string },
    public readonly invite: { id: string; email: string; expiresAt: Date },
  ) {
    super("District invite email delivery failed");
    this.name = "DistrictInviteDeliveryError";
  }
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

/**
 * Guard: refuse onboarding when the email already owns an account or has a
 * still-open invite. Returns a typed conflict instead of throwing so the caller
 * maps it to a 409.
 */
export async function ensureFirstAdminAvailable(
  db: any,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { users } = await import("@aivo/db");
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { ok: false, error: "A user with this email already exists" };
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
    return { ok: false, error: "An invite is already pending for this email." };
  }
  return { ok: true };
}

/**
 * Insert the bare `B2B_DISTRICT` tenant — WITHOUT writing the `district.created`
 * audit. `extraSettings` is merged into the default `{ plan, setupComplete:false }`
 * so the pilot flow can stamp pilot metadata (seat cap, expiry) on the tenant.
 *
 * Audit emission is split out (`recordDistrictCreated`) so the pilot flow can
 * provision billing entitlement BEFORE any audit row references the tenant —
 * `admin_audit_log.tenant_id` FKs `tenants.id`, so a compensating delete of a
 * bare (un-audited) tenant succeeds, but a delete after the audit would not.
 */
export async function insertDistrictTenant(
  db: any,
  args: { districtName: string; extraSettings?: Record<string, unknown> },
): Promise<{ id: string; name: string; type: string; createdAt: Date }> {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: args.districtName,
      type: "B2B_DISTRICT",
      settings: { plan: "enterprise", setupComplete: false, ...(args.extraSettings ?? {}) },
    })
    .returning();
  return tenant;
}

/** Write the `district.created` audit for an already-inserted tenant. */
export async function recordDistrictCreated(
  db: any,
  args: {
    tenant: { id: string; name: string };
    actor: OnboardingActor;
    clientIp: string | null;
    userAgent: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    tenantId: args.tenant.id,
    action: "district.created",
    actorId: args.actor.sub,
    actorEmail: args.actor.email ?? null,
    actorRole: args.actor.role ?? null,
    onBehalfOfId: null,
    resourceType: "tenant",
    resourceId: args.tenant.id,
    details: { districtName: args.tenant.name, ...(args.details ?? {}) },
    ipAddress: args.clientIp,
    userAgent: args.userAgent,
  });
}

/**
 * Convenience: insert the tenant and write its `district.created` audit (the
 * non-pilot create-district path, where no billing step sits between the two).
 */
export async function createDistrictTenant(
  db: any,
  args: {
    districtName: string;
    actor: OnboardingActor;
    clientIp: string | null;
    userAgent: string | null;
    extraSettings?: Record<string, unknown>;
  },
): Promise<{ id: string; name: string; type: string; createdAt: Date }> {
  const tenant = await insertDistrictTenant(db, {
    districtName: args.districtName,
    extraSettings: args.extraSettings,
  });
  await recordDistrictCreated(db, {
    tenant,
    actor: args.actor,
    clientIp: args.clientIp,
    userAgent: args.userAgent,
  });
  return tenant;
}

/**
 * Create the hashed first-admin invite, write `district_admin.invited`, record
 * the observability metric, and deliver the email. On delivery failure the
 * invite row is already persisted (so an operator can resend), and a
 * `DistrictInviteDeliveryError` is thrown carrying the partial result.
 */
export async function inviteFirstDistrictAdmin(
  db: any,
  args: {
    tenant: { id: string; name: string; type: string };
    adminName: string;
    adminEmail: string;
    actor: OnboardingActor;
    clientIp: string | null;
    userAgent: string | null;
  },
): Promise<{
  invite: { id: string; email: string; expiresAt: Date };
  delivery: { inviteUrl?: string };
}> {
  const email = args.adminEmail.trim().toLowerCase();
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  const [invite] = await db
    .insert(districtAdminInvites)
    .values({
      tenantId: args.tenant.id,
      email,
      name: args.adminName,
      role: "DISTRICT_ADMIN",
      invitedBy: args.actor.sub,
      tokenHash: hashInviteToken(rawToken),
      expiresAt,
    })
    .returning();

  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    tenantId: args.tenant.id,
    action: "district_admin.invited",
    actorId: args.actor.sub,
    actorEmail: args.actor.email ?? null,
    actorRole: args.actor.role ?? null,
    onBehalfOfId: null,
    resourceType: "district_admin_invite",
    resourceId: invite.id,
    details: { districtName: args.tenant.name, email },
    ipAddress: args.clientIp,
    userAgent: args.userAgent,
  });
  recordDistrictInviteCreated({
    inviteId: invite.id,
    tenantId: args.tenant.id,
    source: "platform",
  });

  const inviteUrl = `${process.env.WEB_BASE_URL || "https://app.aivolearning.com"}/accept-invite?token=${rawToken}`;
  let delivery: { inviteUrl?: string };
  try {
    delivery = await sendDistrictAdminInvite({
      to: email,
      name: args.adminName,
      districtName: args.tenant.name,
      inviteUrl,
    });
  } catch {
    throw new DistrictInviteDeliveryError(args.tenant, { id: invite.id, email, expiresAt });
  }

  return { invite: { id: invite.id, email, expiresAt }, delivery };
}
