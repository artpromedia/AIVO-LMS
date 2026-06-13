/**
 * Sprint C-16 — contributor retention: the metric + its read-path.
 *
 * THE DoD METRIC. "contributor retention measured" = repeat-contribution rate:
 * of contributors whose input was ACKNOWLEDGED, the share who CONTRIBUTE AGAIN
 * within 60 days of the acknowledgement.
 *
 * WHERE EVENTS LAND (mirrors C-14's reveal funnel). web-v2 has no product-
 * analytics warehouse; the durable, timestamped, tenant-scoped, queryable event
 * log that exists is the append-only `audit_logs` table. C-16 records two
 * audit-row kinds under the `contribution.*` namespace:
 *   - `contribution.acknowledged` — written at approval, once per (contributor,
 *     learner, revision); metadata carries the contributor key + role.
 *   - `contribution.submitted` — written whenever a contributor lands a new
 *     contribution (teacher/therapist assessment submit, caregiver observation /
 *     insight); metadata carries the contributor key + role.
 * The retention read-path joins those rows in this PURE reducer. No new
 * warehouse, no dashboard (out of scope) — a computable rate, which is the DoD.
 *
 * This module is the contract + the pure reducer: the producer (audit write in
 * repos.ts / the contribution BFFs) and the reducer can never drift because the
 * action strings + metadata keys are pinned here.
 */

export const CONTRIBUTION_EVENTS = ["acknowledged", "submitted"] as const;
export type ContributionEventName = (typeof CONTRIBUTION_EVENTS)[number];

/** The `audit` action string for a contribution event. */
export function contributionAction(name: ContributionEventName): string {
  return `contribution.${name}`;
}

/** Parse an `audit` action back to a contribution event name, or null. */
export function parseContributionAction(action: string): ContributionEventName | null {
  if (!action.startsWith("contribution.")) return null;
  const name = action.slice("contribution.".length) as ContributionEventName;
  return (CONTRIBUTION_EVENTS as readonly string[]).includes(name) ? name : null;
}

/**
 * A normalised contribution event. `contributorKey` is the STABLE identity of
 * the contributor across the two event kinds — the lowercased email (an account
 * id can be absent on an email-only invitee, and a person may submit before
 * they create an account). `occurredAt` is the audit row's ISO timestamp.
 */
export type ContributionEvent = {
  name: ContributionEventName;
  contributorKey: string;
  role: string;
  occurredAt: string;
};

/** The minimal audit-row shape the read-path needs (structurally compatible
 *  with `AuditLog`). The contributor key + role live in metadata. */
export type ContributionAuditRow = {
  action: string;
  occurredAt: string;
  metadata?: Record<string, unknown> | null;
};

/** Normalise `contribution.*` audit rows into the flat event stream the reducer
 *  consumes. Rows that aren't contribution events, or carry no contributorKey,
 *  are dropped. */
export function contributionEventsFromAuditLogs(rows: ContributionAuditRow[]): ContributionEvent[] {
  const out: ContributionEvent[] = [];
  for (const row of rows) {
    const name = parseContributionAction(row.action);
    if (!name) continue;
    const key = row.metadata?.contributorKey;
    const role = row.metadata?.role;
    if (typeof key !== "string" || key.length === 0) continue;
    out.push({
      name,
      contributorKey: key,
      role: typeof role === "string" ? role : "unknown",
      occurredAt: row.occurredAt,
    });
  }
  return out;
}

/** The retention summary the read-path returns. */
export type ContributionRetention = {
  /** Distinct contributors who were acknowledged at least once. */
  acknowledgedContributors: number;
  /** Of those, the count who contributed again within the window. */
  repeatContributors: number;
  /** repeatContributors / acknowledgedContributors, in [0,1]; 0 when none were
   *  acknowledged. The headline repeat-contribution rate. */
  repeatRate: number;
  /** The window used, in days (default 60). */
  windowDays: number;
  /** Per-role breakdown (teacher / caregiver / therapist), so the read-path can
   *  show which role retains best. Each carries its own acknowledged / repeat /
   *  rate. */
  byRole: Record<string, { acknowledged: number; repeat: number; rate: number }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the repeat-contribution rate from a flat event stream (any order, any
 * number of contributors). Pure + deterministic.
 *
 * A contributor "repeated" when they have a `contribution.submitted` event
 * STRICTLY AFTER their FIRST `contribution.acknowledged`, within `windowDays`.
 * Using the first acknowledgement as the anchor (and requiring the repeat to be
 * after it) means a submission that PREDATES the acknowledgement — the very one
 * that got folded — is never miscounted as a "repeat". A submission exactly at
 * the acknowledgement instant doesn't count (must be strictly after).
 */
export function computeContributionRetention(
  events: ContributionEvent[],
  windowDays = 60,
): ContributionRetention {
  const windowMs = windowDays * DAY_MS;

  // First acknowledgement timestamp + role per contributor.
  const firstAck = new Map<string, { ts: number; role: string }>();
  // All submission timestamps per contributor.
  const submissions = new Map<string, number[]>();

  for (const e of events) {
    const t = Date.parse(e.occurredAt);
    if (Number.isNaN(t)) continue;
    if (e.name === "acknowledged") {
      const prev = firstAck.get(e.contributorKey);
      if (!prev || t < prev.ts) firstAck.set(e.contributorKey, { ts: t, role: e.role });
    } else {
      const list = submissions.get(e.contributorKey) ?? [];
      list.push(t);
      submissions.set(e.contributorKey, list);
    }
  }

  const roleTally = new Map<string, { acknowledged: number; repeat: number }>();
  const bumpRole = (role: string, repeated: boolean) => {
    const r = roleTally.get(role) ?? { acknowledged: 0, repeat: 0 };
    r.acknowledged += 1;
    if (repeated) r.repeat += 1;
    roleTally.set(role, r);
  };

  let acknowledged = 0;
  let repeat = 0;
  for (const [key, ack] of firstAck) {
    acknowledged += 1;
    const subs = submissions.get(key) ?? [];
    const repeated = subs.some((t) => t > ack.ts && t - ack.ts <= windowMs);
    if (repeated) repeat += 1;
    bumpRole(ack.role, repeated);
  }

  const byRole: ContributionRetention["byRole"] = {};
  for (const [role, r] of roleTally) {
    byRole[role] = {
      acknowledged: r.acknowledged,
      repeat: r.repeat,
      rate: r.acknowledged > 0 ? r.repeat / r.acknowledged : 0,
    };
  }

  return {
    acknowledgedContributors: acknowledged,
    repeatContributors: repeat,
    repeatRate: acknowledged > 0 ? repeat / acknowledged : 0,
    windowDays,
    byRole,
  };
}
