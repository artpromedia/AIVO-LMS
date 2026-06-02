/**
 * Nightly seat-utilization aggregation (Sprint 4).
 *
 * For every district pool this job:
 *   1. promotes future-dated allocations whose `effective_at` has passed
 *      (status `pending` → `effective`) and recomputes `seat_pools.allocated`;
 *   2. pulls the active-user count per child tenant from identity-svc and
 *      writes the rolled-up `seat_pools.used`;
 *   3. raises a `billing.overage` audit event for any tenant whose usage has
 *      crossed its allocation (non-blocking) and flags hard-cap breaches.
 *
 * The HTTP fetch to identity-svc is injected so the aggregation core can be
 * unit-tested without a network or a database.
 */
import { eq } from "drizzle-orm";
import { seatPools, seatAllocations } from "@aivo/db";
import type { JobOutcome } from "@aivo/scheduling";
import { createLogger } from "@aivo/observability";
import { emitBillingAudit } from "../lib/audit.js";
import {
  applyAllocation,
  computeOverage,
  isEffective,
  type AllocationState,
} from "../domain/seats.js";

const log = createLogger("billing-svc.utilization");

export interface ActiveUserCounts {
  /** childTenantId -> active user (seat-consuming) count. */
  [tenantId: string]: number;
}

export type FetchActiveUsers = (poolTenantId: string) => Promise<ActiveUserCounts>;

const IS_PROD = process.env.NODE_ENV === "production";
const IDENTITY_URL = process.env.IDENTITY_SVC_URL || (IS_PROD ? "" : "http://localhost:3001");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

/**
 * Default identity-svc fetcher: GET active-user counts grouped by child
 * tenant for a district. Returns an empty map on any failure so a nightly
 * blip degrades to "no change" rather than zeroing usage.
 */
export const fetchActiveUsersFromIdentity: FetchActiveUsers = async (poolTenantId) => {
  if (!IDENTITY_URL) return {};
  try {
    const res = await fetch(
      `${IDENTITY_URL}/api/internal/active-users?districtTenantId=${encodeURIComponent(poolTenantId)}`,
      { headers: { "x-internal-key": INTERNAL_KEY }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return {};
    const body = (await res.json()) as { counts?: ActiveUserCounts };
    return body.counts ?? {};
  } catch {
    return {};
  }
};

/**
 * Pure aggregation core: given a pool's effective+pending allocation rows
 * and the per-child active-user counts, compute the new materialized
 * `allocated`, the rolled-up `used`, the set of allocation ids to promote,
 * and any overage statuses. No DB, no clock beyond the injected `now`.
 */
export function aggregatePool(args: {
  poolTotal: number;
  hardCap: number | null;
  allocations: Array<{
    id: string;
    fromTenantId: string | null;
    toTenantId: string;
    count: number;
    effectiveAt: Date | string;
    status: string;
  }>;
  activeUsers: ActiveUserCounts;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const promote: string[] = [];

  // Fold effective allocations (including newly-matured ones) into state.
  let state: AllocationState = { poolTotal: args.poolTotal, perSchool: {} };
  const due = args.allocations
    .filter((a) => a.status !== "superseded")
    .filter((a) =>
      isEffective(
        typeof a.effectiveAt === "string" ? a.effectiveAt : a.effectiveAt.toISOString(),
        now,
      ),
    )
    .sort((a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime());
  for (const a of due) {
    if (a.status === "pending") promote.push(a.id);
    const res = applyAllocation(state, {
      from: a.fromTenantId,
      to: a.toTenantId,
      count: a.count,
    });
    if (res.ok) state = res.state;
  }

  const allocated = Object.values(state.perSchool).reduce((s, v) => s + v, 0);
  const used = Object.values(args.activeUsers).reduce((s, v) => s + v, 0);

  // Per-child overage (used vs. that child's own allocation).
  const overages = Object.entries(args.activeUsers)
    .map(([tenantId, childUsed]) =>
      computeOverage({
        tenantId,
        allocated: state.perSchool[tenantId] ?? 0,
        used: childUsed,
        hardCap: args.hardCap,
      }),
    )
    .filter((o) => o.isOver || o.hardCapReached);

  return { allocated, used, promote, overages, perSchool: state.perSchool };
}

/** Scheduler entrypoint — walk every pool and apply the aggregation. */
export interface UtilizationOutcome extends JobOutcome {
  poolsProcessed: number;
  overageEvents: number;
}

export async function runUtilizationForScheduler(
  db: any,
  fetchActiveUsers: FetchActiveUsers = fetchActiveUsersFromIdentity,
): Promise<UtilizationOutcome> {
  const pools = await db.select().from(seatPools);
  let overageEvents = 0;
  let errors = 0;

  for (const pool of pools) {
    try {
      const allocations = await db
        .select()
        .from(seatAllocations)
        .where(eq(seatAllocations.poolId, pool.id));
      const activeUsers = await fetchActiveUsers(pool.tenantId);
      const agg = aggregatePool({
        poolTotal: pool.total,
        hardCap: pool.hardCap ?? null,
        allocations: allocations.map((a: any) => ({
          id: a.id,
          fromTenantId: a.fromTenantId ?? null,
          toTenantId: a.toTenantId,
          count: a.count,
          effectiveAt: a.effectiveAt,
          status: a.status,
        })),
        activeUsers,
      });

      // Promote matured future-dated allocations.
      for (const id of agg.promote) {
        await db
          .update(seatAllocations)
          .set({ status: "effective" })
          .where(eq(seatAllocations.id, id));
      }

      await db
        .update(seatPools)
        .set({ allocated: agg.allocated, used: agg.used, updatedAt: new Date() })
        .where(eq(seatPools.id, pool.id));

      for (const o of agg.overages) {
        overageEvents += 1;
        await emitBillingAudit(db, log, {
          eventType: "billing.overage",
          tenantId: o.tenantId,
          resourceId: pool.id,
          details: {
            districtTenantId: pool.tenantId,
            allocated: o.allocated,
            used: o.used,
            overage: o.overage,
            hardCap: o.hardCap,
            hardCapReached: o.hardCapReached,
          },
        });
      }
    } catch (err: any) {
      errors += 1;
      log.warn("utilization aggregation failed for pool", {
        poolId: pool.id,
        err: err?.message ?? String(err),
      });
    }
  }

  log.info("utilization job complete", { poolsProcessed: pools.length, overageEvents, errors });
  return {
    status: errors === 0 ? "ok" : errors < pools.length ? "partial" : "failed",
    poolsProcessed: pools.length,
    overageEvents,
    errors,
  };
}
