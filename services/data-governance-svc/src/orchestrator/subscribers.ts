/**
 * Registry of data-owning services that implement the governance
 * subscriber contract (`POST /__governance/erase` and `/__governance/export`).
 *
 * Each subscriber, given a `subjectId`, purges or anonymizes that subject's
 * rows (erase) or returns a structured JSON bundle of them (export), and
 * replies with the affected record counts so the orchestrator can compute a
 * reconciliation checksum. See ADR 0034.
 */

export interface Subscriber {
  name: string;
  /** Resolved base URL; falls back to a localhost dev port. */
  baseUrl: string;
}

const IS_PROD = process.env.NODE_ENV === "production";

function url(envVar: string, devDefault: string): string {
  const v = process.env[envVar];
  if (v) return v;
  return IS_PROD ? "" : devDefault;
}

/**
 * The fan-out targets. Order is irrelevant — results are sorted by service
 * name before the checksum is computed so it is deterministic.
 */
export function governanceSubscribers(): Subscriber[] {
  return [
    { name: "identity-svc", baseUrl: url("IDENTITY_SVC_URL", "http://localhost:3001") },
    { name: "tenant-svc", baseUrl: url("TENANT_SVC_URL", "http://localhost:3002") },
    { name: "admin-svc", baseUrl: url("ADMIN_SVC_URL", "http://localhost:3003") },
    { name: "billing-svc", baseUrl: url("BILLING_SVC_URL", "http://localhost:3009") },
    { name: "audit-svc", baseUrl: url("AUDIT_SVC_URL", "http://localhost:3008") },
    { name: "integration-svc", baseUrl: url("INTEGRATION_SVC_URL", "http://localhost:3015") },
    { name: "learning-svc", baseUrl: url("LEARNING_SVC_URL", "http://localhost:3012") },
  ].filter((s) => s.baseUrl !== "");
}

export const INTERNAL_KEY =
  process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

/** Per-service response to a governance erase/export call. */
export interface SubscriberResult {
  service: string;
  ok: boolean;
  /** table/collection -> affected (erased/anonymized/exported) row count. */
  counts: Record<string, number>;
  /** Present on export: the structured JSON payload for this service. */
  bundle?: unknown;
  /** Disposition breakdown for erasure: which counts were anonymized. */
  anonymizedCounts?: Record<string, number>;
  error?: string;
}

export type GovernanceFetch = (
  subscriber: Subscriber,
  path: "/__governance/erase" | "/__governance/export",
  body: Record<string, unknown>,
) => Promise<SubscriberResult>;

/** Default HTTP dispatcher. Network/HTTP failures degrade to `ok:false`. */
export const httpGovernanceFetch: GovernanceFetch = async (subscriber, path, body) => {
  try {
    const res = await fetch(`${subscriber.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { service: subscriber.name, ok: false, counts: {}, error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as Partial<SubscriberResult>;
    return {
      service: subscriber.name,
      ok: true,
      counts: json.counts ?? {},
      bundle: json.bundle,
      anonymizedCounts: json.anonymizedCounts,
    };
  } catch (err) {
    return {
      service: subscriber.name,
      ok: false,
      counts: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
};
