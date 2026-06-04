/**
 * SLO math and error-budget calculations (Sprint 8).
 *
 * Pure functions so the unit suite can assert the arithmetic exactly:
 *   - error budget from an SLO target over a window
 *   - budget consumed / remaining from good vs bad events
 *   - multi-window burn rate (the Google SRE workbook definition)
 *
 * An SLO target of 0.999 over a 30-day window with 1,000,000 events
 * permits 1,000 bad events (the error budget). Burn rate is how fast the
 * budget is being spent relative to "evenly across the window": a burn
 * rate of 1 exhausts the budget exactly at the end of the window.
 */

export interface SloDefinition {
  id: string;
  service: string;
  /** Optional per-tenant SLO; null = service-wide. */
  tenantId: string | null;
  name: string;
  /** Target as a fraction, e.g. 0.999 for 99.9%. */
  target: number;
  /** Rolling window in days. */
  windowDays: number;
  /** PromQL (or equivalent) good/total indicator query. */
  indicatorQuery: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetInput {
  target: number;
  goodEvents: number;
  badEvents: number;
}

export interface BudgetResult {
  totalEvents: number;
  /** Allowed bad events for the window. */
  errorBudget: number;
  /** Bad events observed. */
  consumed: number;
  /** errorBudget - consumed (may go negative when exhausted). */
  remaining: number;
  /** Fraction of budget consumed in [0, ∞). */
  consumedFraction: number;
  /** Observed availability good/total. */
  observedSli: number;
}

export function computeErrorBudget(input: BudgetInput): BudgetResult {
  const totalEvents = input.goodEvents + input.badEvents;
  const errorBudget = totalEvents * (1 - input.target);
  const consumed = input.badEvents;
  const remaining = errorBudget - consumed;
  const consumedFraction =
    errorBudget === 0 ? (consumed > 0 ? Infinity : 0) : consumed / errorBudget;
  const observedSli = totalEvents === 0 ? 1 : input.goodEvents / totalEvents;
  return {
    totalEvents,
    errorBudget: round(errorBudget),
    consumed,
    remaining: round(remaining),
    consumedFraction: round(consumedFraction),
    observedSli: round(observedSli),
  };
}

/**
 * Burn rate over a short lookback window. badRate is the observed error
 * fraction over `lookbackHours`; allowedRate is (1 - target). Burn rate =
 * badRate / allowedRate. >1 means the budget for the whole SLO window will
 * be exhausted before the window ends.
 */
export function burnRate(target: number, badRate: number): number {
  const allowed = 1 - target;
  if (allowed === 0) return badRate > 0 ? Infinity : 0;
  return round(badRate / allowed);
}

/**
 * Hours until the error budget is exhausted at the current burn rate.
 * Returns Infinity when not burning.
 */
export function timeToExhaustionHours(windowDays: number, burn: number): number {
  if (burn <= 0) return Infinity;
  const windowHours = windowDays * 24;
  return round(windowHours / burn);
}

/**
 * Multi-window multi-burn-rate alert decision (SRE workbook): page when a
 * fast window (1h) AND a slow window (6h) both exceed the threshold, so a
 * brief spike doesn't page but a sustained burn does.
 */
export function shouldPageOnBurn(opts: {
  fastWindowBurn: number;
  slowWindowBurn: number;
  threshold: number;
}): boolean {
  return opts.fastWindowBurn >= opts.threshold && opts.slowWindowBurn >= opts.threshold;
}

function round(n: number): number {
  if (!isFinite(n)) return n;
  return Math.round(n * 10000) / 10000;
}
