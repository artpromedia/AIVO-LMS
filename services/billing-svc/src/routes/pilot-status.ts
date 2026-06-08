/**
 * Sprint 4 — pilot operations read model.
 *
 *   GET /api/billing/admin/pilots            — list active district pilots
 *   GET /api/billing/admin/pilots/:tenantId  — one pilot's live ops view
 *
 * Real reads only: joins the ACTIVE pilot subscription + tenant + the
 * provisioning coupon's redemption count, and counts onboarded parents
 * (`users` role PARENT) and learners (`web_learner_profiles`) in the same
 * Postgres the pilot was provisioned into. Platform-admin guarded (Bearer JWT,
 * same check as the admin coupon routes).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { verifyJWT } from "@aivo/security";
import { requirePlatformAdmin } from "./daily-jobs.js";

/**
 * A pilot's detail view is visible to PLATFORM_ADMIN, or to the DISTRICT_ADMIN
 * who owns that tenant (so a district sees its own seats/expiry). Returns the
 * verified JWT payload, or null after sending the error response.
 */
async function requirePilotViewer(
  req: FastifyRequest,
  reply: FastifyReply,
  tenantId: string,
): Promise<any | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  let payload: any;
  try {
    payload = await verifyJWT(auth.slice(7).trim());
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
  if (payload.role === "PLATFORM_ADMIN") return payload;
  if (payload.role === "DISTRICT_ADMIN" && payload.tenantId === tenantId) return payload;
  reply.code(403).send({ error: "forbidden" });
  return null;
}

type Rows = { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
function asRows(result: Rows): Array<Record<string, any>> {
  return Array.isArray(result) ? result : (result.rows ?? []);
}

interface PilotStatus {
  tenantId: string;
  districtName: string | null;
  plan: string | null;
  tier: string | null;
  seatLimit: number | null;
  seatsUsed: number;
  seatsRemaining: number | null;
  parentsOnboarded: number;
  learnersCreated: number;
  couponCode: string | null;
  redemptions: number;
  expiresAt: string | null;
  status: "active" | "expired" | "none";
}

async function loadPilotStatus(db: any, tenantId: string): Promise<PilotStatus | null> {
  const tenant = asRows(
    (await db.execute(sql`
      SELECT id, name, licensing_tier, seat_limit, type
      FROM tenants WHERE id = ${tenantId} LIMIT 1
    `)) as Rows,
  )[0];
  if (!tenant) return null;

  const sub = asRows(
    (await db.execute(sql`
      SELECT plan, status, current_period_end, metadata
      FROM subscriptions
      WHERE tenant_id = ${tenantId} AND status = 'ACTIVE'
      ORDER BY id DESC LIMIT 1
    `)) as Rows,
  )[0];

  const metadata = (sub?.metadata ?? {}) as Record<string, unknown>;
  const couponCode = typeof metadata.couponCode === "string" ? metadata.couponCode : null;

  let redemptions = 0;
  if (couponCode) {
    const couponRow = asRows(
      (await db.execute(
        sql`SELECT redemptions FROM billing_coupons WHERE code = ${couponCode}`,
      )) as Rows,
    )[0];
    redemptions = Number(couponRow?.redemptions ?? 0);
  }

  const learnersCreated = Number(
    asRows(
      (await db.execute(sql`
        SELECT count(*)::int AS c FROM web_learner_profiles WHERE tenant_id = ${tenantId}
      `)) as Rows,
    )[0]?.c ?? 0,
  );
  const parentsOnboarded = Number(
    asRows(
      (await db.execute(sql`
        SELECT count(*)::int AS c FROM users
        WHERE tenant_id = ${tenantId} AND role = 'PARENT' AND deactivated_at IS NULL
      `)) as Rows,
    )[0]?.c ?? 0,
  );

  const seatLimit = typeof tenant.seat_limit === "number" ? tenant.seat_limit : null;
  const expiresAt = sub?.current_period_end ? new Date(sub.current_period_end).toISOString() : null;
  const status: PilotStatus["status"] = !sub
    ? "none"
    : expiresAt && new Date(expiresAt) < new Date()
      ? "expired"
      : "active";

  return {
    tenantId: tenant.id,
    districtName: tenant.name ?? null,
    plan: sub?.plan ?? null,
    tier: tenant.licensing_tier ?? null,
    seatLimit,
    seatsUsed: learnersCreated,
    seatsRemaining: seatLimit == null ? null : Math.max(0, seatLimit - learnersCreated),
    parentsOnboarded,
    learnersCreated,
    couponCode,
    redemptions,
    expiresAt,
    status,
  };
}

export function registerPilotStatusRoutes(app: FastifyInstance, db: any) {
  // List active pilots (district subscriptions provisioned by the pilot flow).
  app.get("/api/billing/admin/pilots", async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;
    const rows = asRows(
      (await db.execute(sql`
        SELECT DISTINCT s.tenant_id
        FROM subscriptions s
        WHERE s.status = 'ACTIVE'
          AND (s.metadata ->> 'provisionedBy' = 'pilot' OR s.plan = 'district')
        ORDER BY s.tenant_id
        LIMIT 500
      `)) as Rows,
    );
    const pilots: PilotStatus[] = [];
    for (const r of rows) {
      const status = await loadPilotStatus(db, r.tenant_id);
      if (status) pilots.push(status);
    }
    return { pilots };
  });

  // One pilot's live ops view.
  app.get<{ Params: { tenantId: string } }>(
    "/api/billing/admin/pilots/:tenantId",
    async (req, reply) => {
      const viewer = await requirePilotViewer(req, reply, req.params.tenantId);
      if (!viewer) return;
      const status = await loadPilotStatus(db, req.params.tenantId);
      if (!status) return reply.code(404).send({ error: "tenant_not_found" });
      return { pilot: status };
    },
  );
}
