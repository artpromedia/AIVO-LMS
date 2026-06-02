/**
 * Right-to-erasure orchestrator (Sprint 5).
 *
 * Fans `subject.erasure.requested` out to every governance subscriber's
 * `POST /__governance/erase`, collects the affected record counts, and
 * computes a reconciliation checksum so a partial fan-out (a service that
 * failed to confirm) is detectable. audit-svc is expected to ANONYMIZE
 * actor info while preserving its hash chain, so its rows show up under
 * `anonymizedCounts` rather than as deletions.
 *
 * The dispatcher is injected so the fan-out can be unit-tested without a
 * network: pass a stub `GovernanceFetch`.
 */
import { createHash } from "node:crypto";
import {
  governanceSubscribers,
  httpGovernanceFetch,
  type GovernanceFetch,
  type Subscriber,
  type SubscriberResult,
} from "./subscribers.js";

export interface ErasureRequest {
  subjectId: string;
  subjectType?: string;
  tenantId?: string | null;
  /** The DSAR this erasure fulfills, for the completion event. */
  dsarId?: string;
}

export interface ErasureOutcome {
  subjectId: string;
  results: SubscriberResult[];
  /** True when every subscriber confirmed (ok). */
  allConfirmed: boolean;
  /** Services that failed to confirm — a partial fan-out. */
  failedServices: string[];
  /** Total rows purged (deleted) across services. */
  totalErased: number;
  /** Total rows anonymized (e.g. audit actor info) across services. */
  totalAnonymized: number;
  /** Deterministic checksum over per-service counts for reconciliation. */
  checksum: string;
}

/** Stable checksum over sorted (service → counts) so re-runs reconcile. */
export function computeChecksum(results: SubscriberResult[]): string {
  const canonical = results
    .slice()
    .sort((a, b) => a.service.localeCompare(b.service))
    .map((r) => ({
      service: r.service,
      ok: r.ok,
      counts: Object.fromEntries(Object.entries(r.counts).sort(([a], [b]) => a.localeCompare(b))),
      anonymizedCounts: r.anonymizedCounts
        ? Object.fromEntries(
            Object.entries(r.anonymizedCounts).sort(([a], [b]) => a.localeCompare(b)),
          )
        : undefined,
    }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function sumCounts(counts: Record<string, number> | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

export async function runErasureFanout(
  req: ErasureRequest,
  opts: { subscribers?: Subscriber[]; fetchImpl?: GovernanceFetch } = {},
): Promise<ErasureOutcome> {
  const subscribers = opts.subscribers ?? governanceSubscribers();
  const fetchImpl = opts.fetchImpl ?? httpGovernanceFetch;
  const body = {
    subjectId: req.subjectId,
    subjectType: req.subjectType ?? "learner",
    tenantId: req.tenantId ?? null,
    dsarId: req.dsarId ?? null,
  };

  const results = await Promise.all(
    subscribers.map((s) => fetchImpl(s, "/__governance/erase", body)),
  );

  const failedServices = results.filter((r) => !r.ok).map((r) => r.service);
  const totalErased = results.reduce((sum, r) => sum + sumCounts(r.counts), 0);
  const totalAnonymized = results.reduce((sum, r) => sum + sumCounts(r.anonymizedCounts), 0);

  return {
    subjectId: req.subjectId,
    results,
    allConfirmed: failedServices.length === 0,
    failedServices,
    totalErased,
    totalAnonymized,
    checksum: computeChecksum(results),
  };
}
