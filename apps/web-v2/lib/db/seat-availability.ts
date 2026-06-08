/**
 * District pilot seat enforcement for the parent learner-create path (Sprint 3).
 *
 * The canonical B2B seat cap lives on `tenants.seat_limit`. A pilot parent
 * creates learners through web-v2 (the `web_learner_profiles` store), so the cap
 * must be enforced HERE too — otherwise a district could blow past its provisioned
 * seats via the parent surface. We count the tenant's web learners against the
 * shared `tenants.seat_limit` (same Postgres the pilot was provisioned into).
 *
 * Seat caps only apply to the real (postgres) store; the in-memory dev store is
 * treated as unlimited so local development isn't gated.
 */
import { eq, count } from "drizzle-orm";
import { tenants, webLearnerProfiles } from "@aivo/db";
import { resolvePersistenceMode } from "@/lib/db/persistence";
import { getDb } from "@/lib/db/persistence/drizzle/client";

export interface SeatAvailability {
  /** `tenants.seat_limit`; null = uncapped (B2C or unset). */
  seatLimit: number | null;
  /** Learners already in this tenant (web_learner_profiles). */
  used: number;
  /** Seats left; null = unlimited. */
  remaining: number | null;
  /** Whether a new learner may be created right now. */
  allowed: boolean;
}

const UNLIMITED: SeatAvailability = { seatLimit: null, used: 0, remaining: null, allowed: true };

export async function getTenantSeatAvailability(tenantId: string): Promise<SeatAvailability> {
  if (resolvePersistenceMode("learners") !== "postgres") return UNLIMITED;

  const db = getDb();
  const [tenant] = await db
    .select({ seatLimit: tenants.seatLimit })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const seatLimit = typeof tenant?.seatLimit === "number" ? tenant.seatLimit : null;
  if (seatLimit == null) return UNLIMITED;

  const [{ value: used }] = await db
    .select({ value: count() })
    .from(webLearnerProfiles)
    .where(eq(webLearnerProfiles.tenantId, tenantId));
  const usedN = Number(used);
  const remaining = Math.max(0, seatLimit - usedN);
  return { seatLimit, used: usedN, remaining, allowed: remaining > 0 };
}
