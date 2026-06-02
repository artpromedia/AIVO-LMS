/**
 * District seat-pooling, rollup, allocation, invoice, and usage routes
 * (Sprint 4). All seat/MRR arithmetic is delegated to the pure helpers in
 * `../domain/seats.js`; this module is the HTTP + persistence shell.
 *
 * RBAC (see the sprint RBAC table):
 *   - summary / pool / invoices / usage : platform_admin (any tenant) or the
 *     tenant's own district/school admin.
 *   - allocate : platform_admin or the owning district_admin.
 *   - plan/change : platform_admin only, and gated by step-up MFA.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  verifyJWT,
  type JWTPayload,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";
import {
  seatPools,
  seatAllocations,
  seatAllocationHistory,
  invoicesCache,
  subscriptions,
  tenants,
} from "@aivo/db";
import { createLogger } from "@aivo/observability";
import { emitBillingAudit } from "../lib/audit.js";
import {
  StripeNotConfiguredError,
  changeSubscriptionPlan,
  downloadInvoicePdf,
} from "../lib/stripe.js";
import {
  applyAllocation,
  classifyEffectiveAt,
  computeArrCents,
  computeMrrCents,
  computeOverage,
  materialize,
  type SeatAllocation,
} from "../domain/seats.js";
import {
  seatSummarySchema,
  seatPoolSchema,
  allocateSeatsSchema,
  listInvoicesCacheSchema,
  getInvoicePdfSchema,
  usageSeriesSchema,
  changePlanSchema,
} from "./schemas.js";

const log = createLogger("billing-svc.seats");

/** Per-seat list price (cents/month) by plan, for MRR/ARR rollups. */
const PLAN_SEAT_RATE_CENTS: Record<string, number> = {
  free: 0,
  single: 2499,
  family: 1999,
  // District contracts are negotiated; default to a list rate but allow a
  // per-pool override via `seat_pools.metadata.perSeatCents`.
  district: 1000,
  school: 1000,
};

async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<JWTPayload | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return null;
  }
  let user: JWTPayload;
  try {
    user = await verifyJWT(auth.slice(7));
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return null;
  }
  // ADR 0020 — x-aivo-active-role is a hint, never a grant.
  const activeRole = checkActiveRole(user.role, req.headers[ACTIVE_ROLE_HEADER], {
    availableRoles: user.availableRoles,
  });
  if (!activeRole.ok) {
    req.log?.warn?.(
      {
        event: ACTIVE_ROLE_SPOOFING_EVENT,
        userId: user.sub,
        tenantId: user.tenantId,
        requested: activeRole.requested,
        granted: activeRole.granted,
      },
      "rejected x-aivo-active-role header",
    );
    reply.status(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
    return null;
  }
  return user;
}

function isPlatform(user: JWTPayload): boolean {
  return user.role === "PLATFORM_ADMIN" || user.role === "platform_admin";
}
function isDistrict(user: JWTPayload): boolean {
  return user.role === "DISTRICT_ADMIN" || user.role === "district_admin";
}

/** Read access: platform sees any tenant; everyone else only their own. */
function ensureOwnTenant(user: JWTPayload, tenantId: string, reply: FastifyReply): boolean {
  if (isPlatform(user) || user.tenantId === tenantId) return true;
  reply.status(403).send({ error: "Access denied" });
  return false;
}

/** Allocate access: platform, or the owning district admin. */
function ensureAllocator(user: JWTPayload, tenantId: string, reply: FastifyReply): boolean {
  if (isPlatform(user)) return true;
  if (isDistrict(user) && user.tenantId === tenantId) return true;
  reply
    .status(403)
    .send({ error: "Only platform or the owning district admin may allocate seats" });
  return false;
}

const IS_PROD = process.env.NODE_ENV === "production";
const IDENTITY_URL = process.env.IDENTITY_SVC_URL || (IS_PROD ? "" : "http://localhost:3001");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

/**
 * Step-up gate for plan changes. Delegates to identity-svc's
 * `verify-internal` so the single-use jti store is shared (matches
 * admin-svc/evidence.ts). Scope `config:update` covers billing-plan
 * mutation. When the step-up flag is off identity returns
 * `{ valid:true, skipped:true }` and we proceed.
 */
async function requirePlanChangeStepUp(
  user: JWTPayload,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const token = (req.headers["x-step-up-token"] as string) || "";
  let res: Response;
  try {
    res = await fetch(`${IDENTITY_URL}/api/auth/step-up/verify-internal`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ token, scope: "config:update", callerSub: user.sub }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    reply.status(502).send({ error: "Step-up verifier unavailable" });
    return false;
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (res.ok && body?.valid) return true;
  const reason = body?.reason || "unknown";
  reply.status(res.status === 401 ? 401 : 403).send({
    error: "Step-up rejected",
    code: "STEP_UP_REQUIRED",
    scope: "config:update",
    reason,
  });
  return false;
}

async function loadSubscription(db: any, tenantId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Load the pool row for a district, synthesizing a zero-allocation pool
 * from `tenants.seat_limit` when none has been provisioned yet so the
 * summary/pool endpoints always return a coherent shape.
 */
async function loadPool(db: any, tenantId: string) {
  const rows = await db.select().from(seatPools).where(eq(seatPools.tenantId, tenantId)).limit(1);
  if (rows[0]) return rows[0];
  const [tenant] = await db
    .select({ seatLimit: tenants.seatLimit })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const sub = await loadSubscription(db, tenantId);
  return {
    id: null,
    tenantId,
    planId: sub?.plan ?? "district",
    total: tenant?.seatLimit ?? 0,
    allocated: 0,
    used: 0,
    hardCap: null,
    metadata: {},
    synthetic: true,
  };
}

/** Effective allocation rows for a pool, as `SeatAllocation` domain shapes. */
async function loadAllocations(db: any, poolId: string | null): Promise<SeatAllocation[]> {
  if (!poolId) return [];
  const rows = await db.select().from(seatAllocations).where(eq(seatAllocations.poolId, poolId));
  return rows
    .filter((r: any) => r.status !== "superseded")
    .map((r: any) => ({
      from_tenant_id: r.fromTenantId ?? null,
      to_tenant_id: r.toTenantId,
      count: r.count,
      effective_at: (r.effectiveAt instanceof Date
        ? r.effectiveAt
        : new Date(r.effectiveAt)
      ).toISOString(),
    }));
}

export function registerSeatRoutes(app: FastifyInstance, db: any) {
  // ── GET summary ────────────────────────────────────────────────────────────
  app.get(
    "/api/billing/:tenantId/summary",
    { schema: seatSummarySchema },
    async (request, reply) => {
      const user = await requireAuth(request, reply);
      if (!user) return;
      const { tenantId } = request.params as { tenantId: string };
      if (!ensureOwnTenant(user, tenantId, reply)) return;

      const [pool, sub] = await Promise.all([
        loadPool(db, tenantId),
        loadSubscription(db, tenantId),
      ]);
      const perSeat =
        (pool.metadata as any)?.perSeatCents ?? PLAN_SEAT_RATE_CENTS[pool.planId] ?? 0;
      const mrrCents = computeMrrCents([
        {
          amountCents: perSeat,
          interval: "month",
          quantity: Math.max(0, pool.total),
          status: (sub?.stripeStatus ?? sub?.status ?? "active").toLowerCase(),
        },
      ]);
      return {
        tenantId,
        plan: pool.planId,
        status: (sub?.stripeStatus ?? sub?.status ?? "active").toLowerCase(),
        renewalDate: sub?.currentPeriodEnd?.toISOString?.() ?? null,
        seats: { total: pool.total, allocated: pool.allocated, used: pool.used },
        mrrCents,
        arrCents: computeArrCents([
          {
            amountCents: perSeat,
            interval: "month",
            quantity: Math.max(0, pool.total),
            status: (sub?.stripeStatus ?? sub?.status ?? "active").toLowerCase(),
          },
        ]),
        currency: "usd",
      };
    },
  );

  // ── GET pool + per-child allocations ────────────────────────────────────────
  app.get("/api/billing/:tenantId/pool", { schema: seatPoolSchema }, async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { tenantId } = request.params as { tenantId: string };
    if (!ensureOwnTenant(user, tenantId, reply)) return;

    const pool = await loadPool(db, tenantId);
    const allocations = await loadAllocations(db, pool.id);
    const now = new Date();
    const state = materialize(pool.total, allocations, now);
    const pending = allocations.filter(
      (a) => classifyEffectiveAt(a.effective_at, now) === "future",
    );

    return {
      pool: {
        tenant_id: pool.tenantId,
        plan_id: pool.planId,
        total: pool.total,
        allocated: pool.id
          ? Object.values(state.perSchool).reduce((s, v) => s + v, 0)
          : pool.allocated,
        used: pool.used,
        hard_cap: pool.hardCap ?? null,
      },
      allocations: Object.entries(state.perSchool).map(([childTenantId, allocated]) => ({
        tenant_id: childTenantId,
        allocated,
      })),
      pending: pending.map((a) => ({
        from_tenant_id: a.from_tenant_id,
        to_tenant_id: a.to_tenant_id,
        count: a.count,
        effective_at: a.effective_at,
      })),
    };
  });

  // ── POST allocate ───────────────────────────────────────────────────────────
  app.post(
    "/api/billing/:tenantId/allocate",
    { schema: allocateSeatsSchema },
    async (request, reply) => {
      const user = await requireAuth(request, reply);
      if (!user) return;
      const { tenantId } = request.params as { tenantId: string };
      if (!ensureAllocator(user, tenantId, reply)) return;

      const body = request.body as {
        from_tenant_id?: string | null;
        to_tenant_id: string;
        count: number;
        effective_at?: string;
      };
      const effectiveAt = body.effective_at ?? new Date().toISOString();
      if (classifyEffectiveAt(effectiveAt) === "invalid") {
        return reply.code(400).send({ error: "effective_at is not a valid date" });
      }

      // Ensure the pool exists (provision lazily from seat_limit).
      let pool = await db
        .select()
        .from(seatPools)
        .where(eq(seatPools.tenantId, tenantId))
        .limit(1)
        .then((r: any[]) => r[0]);
      if (!pool) {
        const synth = await loadPool(db, tenantId);
        const [created] = await db
          .insert(seatPools)
          .values({
            tenantId,
            planId: synth.planId,
            total: synth.total,
            allocated: 0,
            used: 0,
          })
          .returning();
        pool = created;
      }

      // Serialize concurrent allocations on this pool with a row lock so
      // the invariant `sum(allocations) <= pool.total` holds under the
      // 10-parallel-request concurrency test (Sprint 4 DoD).
      try {
        return await db.transaction(async (tx: any) => {
          const [locked] = await tx
            .select()
            .from(seatPools)
            .where(eq(seatPools.id, pool.id))
            .for("update");
          const allocations = await loadAllocations(tx, locked.id);
          const state = materialize(locked.total, allocations, new Date());
          const res = applyAllocation(state, {
            from: body.from_tenant_id ?? null,
            to: body.to_tenant_id,
            count: body.count,
          });
          if (!res.ok) {
            return reply.code(409).send({ error: "Allocation rejected", reason: res.reason });
          }

          // Version = current max for this pool + 1.
          const existing = await tx
            .select({ version: seatAllocations.version })
            .from(seatAllocations)
            .where(eq(seatAllocations.poolId, locked.id))
            .orderBy(desc(seatAllocations.version))
            .limit(1);
          const version = (existing[0]?.version ?? 0) + 1;
          const isFuture = classifyEffectiveAt(effectiveAt) === "future";

          const [row] = await tx
            .insert(seatAllocations)
            .values({
              poolId: locked.id,
              fromTenantId: body.from_tenant_id ?? null,
              toTenantId: body.to_tenant_id,
              count: body.count,
              effectiveAt: new Date(effectiveAt),
              status: isFuture ? "pending" : "effective",
              version,
              createdBy: user.sub,
            })
            .returning();

          await tx.insert(seatAllocationHistory).values({
            allocationId: row.id,
            poolId: locked.id,
            action: "create",
            fromTenantId: body.from_tenant_id ?? null,
            toTenantId: body.to_tenant_id,
            count: body.count,
            effectiveAt: new Date(effectiveAt),
            version,
            actorId: user.sub,
            details: { future: isFuture },
          });

          // Recompute and persist materialized `allocated` for immediate moves.
          if (!isFuture) {
            const newAllocated = Object.values(res.state.perSchool).reduce((s, v) => s + v, 0);
            await tx
              .update(seatPools)
              .set({ allocated: newAllocated, updatedAt: new Date() })
              .where(eq(seatPools.id, locked.id));
          }

          await emitBillingAudit(tx, log, {
            eventType: "billing.seats.allocated",
            tenantId,
            userId: user.sub,
            resourceId: row.id,
            details: {
              from_tenant_id: body.from_tenant_id ?? null,
              to_tenant_id: body.to_tenant_id,
              count: body.count,
              effective_at: effectiveAt,
              future: isFuture,
              version,
            },
          });

          return {
            status: isFuture ? "scheduled" : "applied",
            allocation: {
              id: row.id,
              from_tenant_id: body.from_tenant_id ?? null,
              to_tenant_id: body.to_tenant_id,
              count: body.count,
              effective_at: effectiveAt,
              version,
            },
          };
        });
      } catch (err: any) {
        log.error("allocate failed", { err: err?.message ?? String(err), tenantId });
        return reply.code(500).send({ error: "Allocation failed" });
      }
    },
  );

  // ── GET invoices (cache) ────────────────────────────────────────────────────
  app.get(
    "/api/billing/:tenantId/invoices",
    { schema: listInvoicesCacheSchema },
    async (request, reply) => {
      const user = await requireAuth(request, reply);
      if (!user) return;
      const { tenantId } = request.params as { tenantId: string };
      if (!ensureOwnTenant(user, tenantId, reply)) return;
      const { from, to } = request.query as { from?: string; to?: string };

      const filters = [eq(invoicesCache.tenantId, tenantId)];
      if (from && !Number.isNaN(Date.parse(from)))
        filters.push(gte(invoicesCache.issuedAt, new Date(from)));
      if (to && !Number.isNaN(Date.parse(to)))
        filters.push(lte(invoicesCache.issuedAt, new Date(to)));

      const rows = await db
        .select()
        .from(invoicesCache)
        .where(filters.length === 1 ? filters[0] : and(...filters))
        .orderBy(desc(invoicesCache.issuedAt))
        .limit(200);
      return {
        tenantId,
        invoices: rows.map((r: any) => ({
          id: r.id,
          number: r.number,
          status: r.status,
          amountDue: (r.amountDue ?? 0) / 100,
          amountPaid: (r.amountPaid ?? 0) / 100,
          currency: r.currency,
          periodStart: r.periodStart?.toISOString?.() ?? null,
          periodEnd: r.periodEnd?.toISOString?.() ?? null,
          issuedAt: r.issuedAt?.toISOString?.() ?? null,
          pdfUrl: `/api/billing/${tenantId}/invoices/${r.id}.pdf`,
        })),
      };
    },
  );

  // ── GET invoice PDF (streamed; signed-URL distribution upstream) ─────────────
  app.get(
    "/api/billing/:tenantId/invoices/:id.pdf",
    { schema: getInvoicePdfSchema },
    async (request, reply) => {
      const user = await requireAuth(request, reply);
      if (!user) return;
      const { tenantId, id } = request.params as { tenantId: string; id: string };
      if (!ensureOwnTenant(user, tenantId, reply)) return;

      const [row] = await db
        .select()
        .from(invoicesCache)
        .where(and(eq(invoicesCache.id, id), eq(invoicesCache.tenantId, tenantId)))
        .limit(1);
      if (!row) return reply.code(404).send({ error: "Invoice not found" });

      // Preferred path: a cached PDF in object storage, served via a
      // short-lived signed URL (ADR 0033). Object storage + signing live
      // behind infra config; when unset we fall back to streaming the PDF
      // straight from Stripe so the endpoint still works in every env.
      if (row.pdfObjectKey && process.env.INVOICE_PDF_SIGNED_URL_BASE) {
        const signed = `${process.env.INVOICE_PDF_SIGNED_URL_BASE}/${encodeURIComponent(
          row.pdfObjectKey,
        )}`;
        return reply.redirect(signed, 302);
      }
      try {
        const pdf = await downloadInvoicePdf(row.stripeInvoiceId);
        return reply
          .header("content-type", "application/pdf")
          .header("content-disposition", `inline; filename="${row.number ?? id}.pdf"`)
          .send(pdf);
      } catch (err) {
        if (err instanceof StripeNotConfiguredError) {
          return reply.code(503).send({ error: err.message });
        }
        log.warn("invoice pdf fetch failed", { id, tenantId });
        return reply.code(404).send({ error: "Invoice PDF unavailable" });
      }
    },
  );

  // ── GET usage series ────────────────────────────────────────────────────────
  app.get("/api/billing/:tenantId/usage", { schema: usageSeriesSchema }, async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) return;
    const { tenantId } = request.params as { tenantId: string };
    if (!ensureOwnTenant(user, tenantId, reply)) return;
    const granularity =
      (request.query as { granularity?: string }).granularity === "month" ? "month" : "day";

    const pool = await loadPool(db, tenantId);
    const overage = computeOverage({
      tenantId,
      allocated: pool.allocated,
      used: pool.used,
      hardCap: pool.hardCap ?? null,
    });
    // The authoritative per-period series lives in analytics-svc; here we
    // surface the latest aggregated point from the nightly utilization job
    // so the chart renders without that dependency.
    return {
      tenantId,
      granularity,
      overage,
      series: [
        {
          period: new Date().toISOString().slice(0, granularity === "month" ? 7 : 10),
          allocated: pool.allocated,
          used: pool.used,
        },
      ],
    };
  });

  // ── POST plan change (platform admin only + step-up MFA) ─────────────────────
  app.post(
    "/api/billing/:tenantId/plan/change",
    { schema: changePlanSchema },
    async (request, reply) => {
      const user = await requireAuth(request, reply);
      if (!user) return;
      const { tenantId } = request.params as { tenantId: string };
      if (!isPlatform(user)) {
        return reply.code(403).send({ error: "Only platform admins may change plans" });
      }
      if (!(await requirePlanChangeStepUp(user, request, reply))) return;

      const { planId } = request.body as { planId: string };
      const sub = await loadSubscription(db, tenantId);
      const previousPlan = sub?.plan ?? "free";

      // Push the change to Stripe when a live subscription + price exist.
      const newPriceId =
        planId === "single"
          ? process.env.STRIPE_PRICE_SINGLE
          : planId === "family"
            ? process.env.STRIPE_PRICE_FAMILY
            : null;
      if (sub?.stripeSubscriptionId && newPriceId) {
        try {
          await changeSubscriptionPlan({
            stripeSubscriptionId: sub.stripeSubscriptionId,
            newPriceId,
          });
        } catch (err) {
          if (!(err instanceof StripeNotConfiguredError)) {
            log.warn("stripe plan change failed", { tenantId });
          }
        }
      }
      if (sub) {
        await db
          .update(subscriptions)
          .set({ plan: planId, updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
      }
      await db
        .update(seatPools)
        .set({ planId, updatedAt: new Date() })
        .where(eq(seatPools.tenantId, tenantId));

      await emitBillingAudit(db, log, {
        eventType: "billing.plan.changed",
        tenantId,
        userId: user.sub,
        resourceId: sub?.stripeSubscriptionId ?? tenantId,
        details: { from: previousPlan, to: planId },
      });
      return { status: "changed", tenantId, plan: planId, previousPlan };
    },
  );
}
