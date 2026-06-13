/**
 * Sprint C-14 — reveal instrumentation: events + the conversion read-path.
 *
 * WHERE EVENTS LAND. web-v2 has no general product-analytics warehouse; the
 * durable, timestamped, tenant-scoped, queryable event log that DOES exist is
 * the append-only `audit_logs` table (`lib/bff/audit.ts` → `AuditStore`). The
 * approval itself is already a first-class row in `brain_profile_approvals`
 * (with `createdAt`). So reveal events are recorded as audit rows under the
 * `reveal.*` action namespace, and the funnel read-path joins those audit rows
 * to the approval record. No new warehouse, no dashboard (out of scope) — a
 * computable funnel, which is the DoD.
 *
 * This module is the contract + the PURE reducer. `computeRevealFunnel` takes
 * the recorded events and returns completion→approval conversion and
 * time-to-approve — fully unit-testable with no DB. The recording side (audit
 * write) lives in the page/BFF; the event names + payload shape are pinned here
 * so the producer and the reducer can never drift.
 */

/**
 * The reveal funnel steps, in order. Each maps to an `audit` action
 * `reveal.<step>`. `approved`/`amended` are terminal; `share_artifact_created`
 * is a post-approval action (it can fire after `approved`).
 */
export const REVEAL_EVENTS = [
  "reveal_started", // the stitched flow began (screen 1 mounted)
  "screen_advanced", // a per-screen advance (payload carries `screen`)
  "corrections_opened", // the parent opened the C-05 correction screen (screen 5)
  "ceremony_reached", // the approval ceremony surface was reached (screen 6)
  "approved", // approved as-is
  "amended", // approved with corrections folded
  "share_artifact_created", // the strengths-only share artifact was generated
] as const;

export type RevealEventName = (typeof REVEAL_EVENTS)[number];

/** The `audit` action string for a reveal event. */
export function revealAction(name: RevealEventName): string {
  return `reveal.${name}`;
}

/** Parse an `audit` action back to a reveal event name, or null. */
export function parseRevealAction(action: string): RevealEventName | null {
  if (!action.startsWith("reveal.")) return null;
  const name = action.slice("reveal.".length) as RevealEventName;
  return (REVEAL_EVENTS as readonly string[]).includes(name) ? name : null;
}

/**
 * A recorded reveal event, normalised from an audit row. `learnerId` scopes the
 * funnel to one child; `occurredAt` is the audit row's timestamp (ISO) — the
 * spine of the time-to-approve computation. `screen` is set on `screen_advanced`.
 */
export type RevealEvent = {
  name: RevealEventName;
  learnerId: string;
  occurredAt: string;
  /** 1–7 on a `screen_advanced` event; undefined otherwise. */
  screen?: number;
  /** The actor who fired it (parent userId); informational. */
  actorUserId?: string | null;
};

/**
 * The minimal audit-row shape the read-path needs. Structurally compatible with
 * `AuditLog` (`lib/db/types.ts`) — typed locally so this pure module has no DB
 * import. An admin query reads audit rows for a tenant and pipes them here.
 */
export type RevealAuditRow = {
  action: string;
  learnerId: string | null;
  occurredAt: string;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * The conversion read-path: normalise `reveal.*` audit rows into the flat
 * `RevealEvent[]` the funnel reducer consumes. Rows that aren't reveal events,
 * or that carry no learnerId, are dropped. The `screen` is pulled from the
 * audit metadata for `screen_advanced`. This is the only glue between the
 * durable audit log and `computeRevealFunnel`.
 */
export function revealEventsFromAuditLogs(rows: RevealAuditRow[]): RevealEvent[] {
  const out: RevealEvent[] = [];
  for (const row of rows) {
    const name = parseRevealAction(row.action);
    if (!name || !row.learnerId) continue;
    const screen = row.metadata?.screen;
    out.push({
      name,
      learnerId: row.learnerId,
      occurredAt: row.occurredAt,
      actorUserId: row.userId ?? null,
      ...(typeof screen === "number" ? { screen } : {}),
    });
  }
  return out;
}

/** The funnel + timing summary the conversion read-path returns. */
export type RevealFunnel = {
  /** Distinct learners whose reveal started. */
  started: number;
  /** Distinct learners who reached the ceremony. */
  ceremonyReached: number;
  /** Distinct learners who approved or amended. */
  approved: number;
  /** Distinct learners who created the share artifact. */
  shared: number;
  /** approved / started, in [0,1]; 0 when nobody started. The headline
   *  "reveal completion → approval conversion". */
  conversion: number;
  /** Median seconds from `reveal_started` to `approved`/`amended`, over the
   *  learners who did both; null when none. The "time-to-approve". */
  medianTimeToApproveSeconds: number | null;
  /** Per-learner time-to-approve in seconds (started→approved), for drill-in. */
  timeToApproveSeconds: { learnerId: string; seconds: number }[];
};

/**
 * Compute the reveal funnel from a flat event stream (any order, any number of
 * learners). Pure + deterministic.
 *
 * Conversion = distinct approvers / distinct starters. Time-to-approve uses the
 * EARLIEST `reveal_started` and the EARLIEST terminal (`approved`|`amended`)
 * per learner so a replay/re-entry doesn't inflate the duration.
 */
export function computeRevealFunnel(events: RevealEvent[]): RevealFunnel {
  const startedAt = new Map<string, number>();
  const ceremonyAt = new Map<string, number>();
  const approvedAt = new Map<string, number>();
  const sharedLearners = new Set<string>();

  for (const e of events) {
    const t = Date.parse(e.occurredAt);
    if (Number.isNaN(t)) continue;
    switch (e.name) {
      case "reveal_started":
        keepEarliest(startedAt, e.learnerId, t);
        break;
      case "ceremony_reached":
        keepEarliest(ceremonyAt, e.learnerId, t);
        break;
      case "approved":
      case "amended":
        keepEarliest(approvedAt, e.learnerId, t);
        break;
      case "share_artifact_created":
        sharedLearners.add(e.learnerId);
        break;
      default:
        break;
    }
  }

  const started = startedAt.size;
  const approved = approvedAt.size;

  const timeToApproveSeconds: { learnerId: string; seconds: number }[] = [];
  for (const [learnerId, approvedTs] of approvedAt) {
    const startTs = startedAt.get(learnerId);
    if (startTs == null || approvedTs < startTs) continue;
    timeToApproveSeconds.push({
      learnerId,
      seconds: Math.round((approvedTs - startTs) / 1000),
    });
  }
  timeToApproveSeconds.sort((a, b) => a.learnerId.localeCompare(b.learnerId));

  return {
    started,
    ceremonyReached: ceremonyAt.size,
    approved,
    shared: sharedLearners.size,
    conversion: started > 0 ? approved / started : 0,
    medianTimeToApproveSeconds: median(timeToApproveSeconds.map((t) => t.seconds)),
    timeToApproveSeconds,
  };
}

function keepEarliest(map: Map<string, number>, key: string, ts: number): void {
  const prev = map.get(key);
  if (prev == null || ts < prev) map.set(key, ts);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}
