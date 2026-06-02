/**
 * District seat-pooling domain model.
 *
 * Pure, dependency-free functions so the allocation invariants, MRR/ARR
 * math, future-dating rules, and concurrency behavior can be unit-tested
 * without a database or Stripe. Routes (`src/routes/seats.ts`) and the
 * nightly job (`src/jobs/utilization.ts`) compose these helpers; all the
 * money/seat arithmetic lives here so there is exactly one place to audit
 * for correctness (see ADR 0033).
 *
 * Vocabulary:
 *   - A **pool** belongs to a parent tenant (a district). It holds the
 *     total number of contracted seats the district has bought.
 *   - Each **child tenant** (a school) is *allocated* a slice of the pool.
 *     The sum of every school's allocation can never exceed `pool.total`;
 *     the difference is the *unallocated remainder*.
 *   - **Usage** (`used`) is how many seats a school is actually consuming.
 *     Usage may legally exceed a school's allocation — that is an
 *     *overage*, which is reported as an event, not blocked (unless a
 *     hard-cap is configured).
 */

/** A district-level pool of contracted seats. Mirrors the `seat_pools` row. */
export interface SeatPool {
  tenant_id: string;
  total: number;
  allocated: number;
  used: number;
  plan_id: string;
}

/**
 * A single seat-movement record. Mirrors the `seat_allocations` row.
 * `from_tenant_id === null` means the seats are drawn from the pool's
 * unallocated remainder (a fresh grant) rather than taken from a sibling.
 */
export interface SeatAllocation {
  from_tenant_id: string | null;
  to_tenant_id: string;
  count: number;
  effective_at: string; // ISO-8601
}

/**
 * The materialized per-school allocation state for a pool: how many seats
 * each child tenant currently holds. `unallocated` is derived. This is the
 * shape the allocation invariants operate on.
 */
export interface AllocationState {
  poolTotal: number;
  /** childTenantId -> seats currently allocated to that school. */
  perSchool: Record<string, number>;
}

export type AllocationRejectReason =
  | "non_positive_count"
  | "exceeds_pool_total"
  | "insufficient_source"
  | "same_source_and_target"
  | "unknown_source";

export interface AllocationResult {
  ok: boolean;
  reason?: AllocationRejectReason;
  /** The state after applying the move (unchanged when `ok` is false). */
  state: AllocationState;
}

export function sumAllocated(state: AllocationState): number {
  let sum = 0;
  for (const v of Object.values(state.perSchool)) sum += v;
  return sum;
}

export function unallocated(state: AllocationState): number {
  return state.poolTotal - sumAllocated(state);
}

/**
 * The maximum number of seats that could be granted to `toTenantId` right
 * now: the unallocated remainder, plus whatever the school already holds
 * (raising its own allocation never needs to free others). Encodes the
 * business rule "cannot allocate more seats to a school than
 * `pool.total - sum(other allocations)`".
 */
export function maxAllocatableTo(state: AllocationState, toTenantId: string): number {
  const others = sumAllocated(state) - (state.perSchool[toTenantId] ?? 0);
  return state.poolTotal - others;
}

/**
 * Validate and apply a single allocation move against a state snapshot.
 * Never mutates the input; returns a fresh state on success. The pool sum
 * is conserved for school→school moves and only ever grows toward (never
 * past) `poolTotal` for pool→school grants, so the invariant
 * `sumAllocated <= poolTotal` holds for every accepted move.
 */
export function applyAllocation(
  state: AllocationState,
  move: { from: string | null; to: string; count: number },
): AllocationResult {
  const { from, to, count } = move;
  if (!Number.isInteger(count) || count <= 0) {
    return { ok: false, reason: "non_positive_count", state };
  }
  if (from !== null && from === to) {
    return { ok: false, reason: "same_source_and_target", state };
  }

  const perSchool = { ...state.perSchool };
  const next: AllocationState = { poolTotal: state.poolTotal, perSchool };

  if (from === null) {
    // Fresh grant from the unallocated remainder.
    if (count > unallocated(state)) {
      return { ok: false, reason: "exceeds_pool_total", state };
    }
    perSchool[to] = (perSchool[to] ?? 0) + count;
    return { ok: true, state: next };
  }

  // School → school transfer. The source must actually hold the seats.
  const held = state.perSchool[from];
  if (held === undefined) {
    return { ok: false, reason: "unknown_source", state };
  }
  if (count > held) {
    return { ok: false, reason: "insufficient_source", state };
  }
  perSchool[from] = held - count;
  perSchool[to] = (perSchool[to] ?? 0) + count;
  return { ok: true, state: next };
}

export interface ConcurrentOutcome {
  state: AllocationState;
  applied: number[];
  rejected: Array<{ index: number; reason: AllocationRejectReason }>;
}

/**
 * Serialize a batch of allocation moves against a single starting state,
 * the way a row-locked transaction loop would: each move is validated
 * against the *current* state, accepted moves advance it, rejected ones do
 * not. Models the concurrency requirement — "10 parallel allocations on
 * the same pool: only valid ones succeed, total never exceeds pool." The
 * conserved-sum invariant guarantees the last property by construction.
 */
export function applyConcurrent(
  initial: AllocationState,
  moves: Array<{ from: string | null; to: string; count: number }>,
): ConcurrentOutcome {
  let state = initial;
  const applied: number[] = [];
  const rejected: Array<{ index: number; reason: AllocationRejectReason }> = [];
  moves.forEach((move, index) => {
    const res = applyAllocation(state, move);
    if (res.ok) {
      state = res.state;
      applied.push(index);
    } else {
      rejected.push({ index, reason: res.reason! });
    }
  });
  return { state, applied, rejected };
}

// ── Future-dating ────────────────────────────────────────────────────────────

export type EffectiveAtClass = "immediate" | "future" | "invalid";

/**
 * Classify an `effective_at` relative to `now`. Future-dated allocations
 * are persisted but not folded into the live materialized state until
 * their effective date passes (the utilization job promotes them). Past or
 * present dates take effect immediately.
 */
export function classifyEffectiveAt(effectiveAt: string, now: Date = new Date()): EffectiveAtClass {
  const t = Date.parse(effectiveAt);
  if (Number.isNaN(t)) return "invalid";
  return t > now.getTime() ? "future" : "immediate";
}

export function isEffective(effectiveAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(effectiveAt);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

/**
 * Fold a list of allocation records into the materialized state as of
 * `asOf`, applying only the ones whose `effective_at` has arrived, in
 * chronological order. Used to rebuild `perSchool` from the immutable
 * `seat_allocations` log (and by the nightly job to promote future-dated
 * rows once they mature).
 */
export function materialize(
  poolTotal: number,
  allocations: SeatAllocation[],
  asOf: Date = new Date(),
): AllocationState {
  const due = allocations
    .filter((a) => isEffective(a.effective_at, asOf))
    .sort((a, b) => Date.parse(a.effective_at) - Date.parse(b.effective_at));
  let state: AllocationState = { poolTotal, perSchool: {} };
  for (const a of due) {
    const res = applyAllocation(state, {
      from: a.from_tenant_id,
      to: a.to_tenant_id,
      count: a.count,
    });
    // Skip rows that no longer fit (e.g. a later pool shrink); the
    // allocate route is the gatekeeper, this is a defensive replay.
    if (res.ok) state = res.state;
  }
  return state;
}

// ── Overage ──────────────────────────────────────────────────────────────────

export interface OverageStatus {
  tenantId: string;
  allocated: number;
  used: number;
  overage: number; // used - allocated, floored at 0
  isOver: boolean;
  /** Hard-cap effective ceiling for usage, when configured per tenant. */
  hardCap: number | null;
  /** True only when a hard-cap is configured and usage has reached it. */
  hardCapReached: boolean;
}

/**
 * Compute overage for a school. Over-utilization never blocks usage on its
 * own — callers raise a `billing.overage` event and keep serving — but a
 * per-tenant `hardCap` (when set) is the one ceiling that does block.
 */
export function computeOverage(args: {
  tenantId: string;
  allocated: number;
  used: number;
  hardCap?: number | null;
}): OverageStatus {
  const overage = Math.max(0, args.used - args.allocated);
  const hardCap = args.hardCap ?? null;
  return {
    tenantId: args.tenantId,
    allocated: args.allocated,
    used: args.used,
    overage,
    isOver: overage > 0,
    hardCap,
    hardCapReached: hardCap !== null && args.used >= hardCap,
  };
}

// ── MRR / ARR / churn ──────────────────────────────────────────────────────

export type BillingInterval = "month" | "year";

export interface RecurringLine {
  /** Recurring amount in cents for one interval. */
  amountCents: number;
  interval: BillingInterval;
  /** Seat / learner quantity the price is multiplied by. Defaults to 1. */
  quantity?: number;
  status: string;
}

/**
 * Subscription statuses that contribute to recognized recurring revenue.
 * Trials ($0) and canceled/incomplete subs are excluded so MRR reflects
 * money actually being recognized under ASC 606.
 */
export const MRR_RECOGNIZED_STATUSES: ReadonlySet<string> = new Set(["active", "past_due"]);

/** Normalize a single recurring line to a monthly cents figure. */
export function monthlyCents(line: RecurringLine): number {
  const qty = line.quantity ?? 1;
  const perInterval = line.amountCents * qty;
  return line.interval === "year" ? perInterval / 12 : perInterval;
}

/**
 * Monthly Recurring Revenue in cents. Annual lines are normalized to a
 * monthly figure; only recognized statuses count. Returns a rounded
 * integer so callers don't accumulate fractional-cent drift.
 */
export function computeMrrCents(lines: RecurringLine[]): number {
  let mrr = 0;
  for (const line of lines) {
    if (!MRR_RECOGNIZED_STATUSES.has(line.status)) continue;
    mrr += monthlyCents(line);
  }
  return Math.round(mrr);
}

/** Annual Recurring Revenue: MRR × 12. */
export function computeArrCents(lines: RecurringLine[]): number {
  return computeMrrCents(lines) * 12;
}

/**
 * Logo/revenue churn over a period. `churnedMrrCents` is the MRR lost from
 * cancellations/downgrades; `startingMrrCents` is the MRR at the start of
 * the period. Returns a 0..1 ratio; a zero starting base yields 0 to avoid
 * a divide-by-zero that would render as NaN on the platform dashboard.
 */
export function churnRate(startingMrrCents: number, churnedMrrCents: number): number {
  if (startingMrrCents <= 0) return 0;
  return churnedMrrCents / startingMrrCents;
}
