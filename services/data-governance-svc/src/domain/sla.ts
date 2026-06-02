/**
 * DSAR SLA timer math (Sprint 5).
 *
 * Pure functions so the deadline and overdue calculations can be unit-
 * tested without a DB or a clock. Two clocks run on every request:
 *   - acknowledgement: default 72h from intake.
 *   - fulfillment: regulation-driven — GDPR Art. 12 is 30 days, CCPA/CPRA
 *     is 45 days. When a request falls under multiple regimes we pick the
 *     STRICTER (shorter) window, per the sprint SLA rule. All windows are
 *     configurable per tenant.
 */

export type Regulation = "gdpr" | "ccpa" | "ferpa";

/** Statutory fulfillment windows in days, before any tenant override. */
export const REGULATION_FULFILLMENT_DAYS: Record<Regulation, number> = {
  gdpr: 30,
  ccpa: 45,
  ferpa: 45,
};

export const DEFAULT_ACK_HOURS = 72;

export interface SlaConfig {
  ackHours: number;
  fulfillmentDays: number;
}

export interface SlaDeadlines {
  ackDueAt: string; // ISO
  fulfillmentDueAt: string; // ISO
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The stricter (minimum) fulfillment window across the regulations that
 * apply to a request. Empty input falls back to the GDPR window.
 */
export function stricterFulfillmentDays(regulations: Regulation[]): number {
  if (regulations.length === 0) return REGULATION_FULFILLMENT_DAYS.gdpr;
  return Math.min(...regulations.map((r) => REGULATION_FULFILLMENT_DAYS[r]));
}

/**
 * Resolve the effective SLA config for a request: start from the
 * regulation's statutory window, then apply any per-tenant override. A
 * tenant may only make the clock STRICTER, never looser, so an override
 * that is larger than the statutory window is clamped.
 */
export function resolveSlaConfig(
  regulations: Regulation[],
  tenantOverride?: Partial<SlaConfig>,
): SlaConfig {
  const statutoryDays = stricterFulfillmentDays(regulations);
  const ackHours = tenantOverride?.ackHours ?? DEFAULT_ACK_HOURS;
  const fulfillmentDays =
    tenantOverride?.fulfillmentDays !== undefined
      ? Math.min(tenantOverride.fulfillmentDays, statutoryDays)
      : statutoryDays;
  return {
    ackHours: Math.min(ackHours, DEFAULT_ACK_HOURS),
    fulfillmentDays,
  };
}

export function computeDeadlines(createdAt: Date | string, config: SlaConfig): SlaDeadlines {
  const start = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const base = start.getTime();
  return {
    ackDueAt: new Date(base + config.ackHours * HOUR_MS).toISOString(),
    fulfillmentDueAt: new Date(base + config.fulfillmentDays * DAY_MS).toISOString(),
  };
}

export type SlaState = "on_track" | "due_soon" | "overdue" | "met";

export interface SlaStatus {
  ackOverdue: boolean;
  fulfillmentOverdue: boolean;
  /** ms until fulfillment due (negative when overdue). */
  fulfillmentRemainingMs: number;
  ackRemainingMs: number;
  state: SlaState;
}

/**
 * Evaluate a request's live SLA state.
 *
 * `acknowledgedAt`/`fulfilledAt` stop the respective clocks. Once
 * fulfilled the state is `met`. "due_soon" fires when less than
 * `dueSoonDays` (default 3) remain on the fulfillment clock.
 */
export function evaluateSla(args: {
  deadlines: SlaDeadlines;
  now?: Date;
  acknowledgedAt?: Date | string | null;
  fulfilledAt?: Date | string | null;
  dueSoonDays?: number;
}): SlaStatus {
  const now = (args.now ?? new Date()).getTime();
  const ackDue = new Date(args.deadlines.ackDueAt).getTime();
  const fulfillDue = new Date(args.deadlines.fulfillmentDueAt).getTime();
  const dueSoonMs = (args.dueSoonDays ?? 3) * DAY_MS;

  const acknowledged = args.acknowledgedAt ? new Date(args.acknowledgedAt).getTime() : null;
  const fulfilled = args.fulfilledAt ? new Date(args.fulfilledAt).getTime() : null;

  // Ack clock stops at acknowledgement; only overdue if it passed unmet.
  const ackOverdue = acknowledged === null && now > ackDue;
  const ackRemainingMs =
    (acknowledged ?? now) <= ackDue ? ackDue - (acknowledged ?? now) : ackDue - now;

  if (fulfilled !== null) {
    return {
      ackOverdue: acknowledged === null ? fulfilled > ackDue : acknowledged > ackDue,
      fulfillmentOverdue: fulfilled > fulfillDue,
      fulfillmentRemainingMs: fulfillDue - fulfilled,
      ackRemainingMs,
      state: "met",
    };
  }

  const fulfillmentRemainingMs = fulfillDue - now;
  const fulfillmentOverdue = fulfillmentRemainingMs < 0;
  // `state` tracks the fulfillment clock (the headline SLA). A missed ack is
  // surfaced separately via `ackOverdue` so a late ack doesn't mask how much
  // fulfillment runway remains.
  let state: SlaState;
  if (fulfillmentOverdue) state = "overdue";
  else if (fulfillmentRemainingMs <= dueSoonMs) state = "due_soon";
  else state = "on_track";

  return { ackOverdue, fulfillmentOverdue, fulfillmentRemainingMs, ackRemainingMs, state };
}

/** Human-friendly remaining-time label, e.g. "2d 4h" or "overdue 3h". */
export function formatRemaining(ms: number): string {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / HOUR_MS);
  const core = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  return overdue ? `overdue ${core}` : core;
}
