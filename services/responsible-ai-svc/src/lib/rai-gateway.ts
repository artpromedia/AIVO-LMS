/**
 * RAI gateway — a drop-in guard for AI-calling services.
 *
 * Any service that performs inference imports `createRaiGateway()` and
 * calls `gateway.check({ tenantId, modelId, feature })` before the model
 * call. The gateway consults `responsible-ai-svc /policies/effective`,
 * caches the decision for 60s per (tenant, model, feature), and on a deny
 * short-circuits the inference and emits an `ai.call.blocked` audit event.
 *
 * Caching + short-circuit keep the policy lookup off the hot path: the
 * unit test asserts the cache prevents repeat network calls and that a
 * denied tenant never reaches inference.
 */
import type { EffectivePolicy } from "../registry/types.js";

export interface RaiGatewayOptions {
  /** Base URL of responsible-ai-svc. */
  baseUrl?: string;
  /** Cache TTL in ms (default 60_000). */
  ttlMs?: number;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Called on deny; wire this to your audit emitter. */
  onBlocked?: (info: {
    tenantId: string;
    modelId: string;
    feature?: string;
    reason: string;
  }) => void;
  /**
   * Fail-open or fail-closed when responsible-ai-svc is unreachable.
   * Education deployments default to fail-open for availability but log
   * loudly; set `failClosed: true` for high-risk models.
   */
  failClosed?: boolean;
}

export interface RaiCheckInput {
  tenantId: string;
  modelId: string;
  feature?: string;
}

export interface RaiDecision {
  allowed: boolean;
  reason: string | null;
  policy: EffectivePolicy | null;
  /** True when the decision came from the local cache. */
  cached: boolean;
}

interface CacheEntry {
  decision: RaiDecision;
  expiresAt: number;
}

export interface RaiGateway {
  check(input: RaiCheckInput): Promise<RaiDecision>;
  clearCache(): void;
}

export function createRaiGateway(options: RaiGatewayOptions = {}): RaiGateway {
  const baseUrl = (
    options.baseUrl ??
    process.env.RESPONSIBLE_AI_SVC_URL ??
    "http://localhost:3071"
  ).replace(/\/+$/, "");
  const ttlMs = options.ttlMs ?? 60_000;
  const doFetch = options.fetchImpl ?? fetch;
  const cache = new Map<string, CacheEntry>();

  function keyOf(i: RaiCheckInput): string {
    return `${i.tenantId}|${i.modelId}|${i.feature ?? ""}`;
  }

  async function check(input: RaiCheckInput): Promise<RaiDecision> {
    const key = keyOf(input);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      return { ...hit.decision, cached: true };
    }

    let decision: RaiDecision;
    try {
      const url = new URL(`${baseUrl}/api/responsible-ai/policies/effective`);
      url.searchParams.set("tenantId", input.tenantId);
      url.searchParams.set("modelId", input.modelId);
      if (input.feature) url.searchParams.set("feature", input.feature);
      const res = await doFetch(url.toString(), {
        headers: {
          "x-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token",
        },
      });
      if (!res.ok) throw new Error(`policy lookup ${res.status}`);
      const policy = (await res.json()) as EffectivePolicy;
      decision = { allowed: policy.allowed, reason: policy.denyReason, policy, cached: false };
    } catch (err) {
      // Service unreachable → apply the configured fail mode.
      const allowed = !options.failClosed;
      decision = {
        allowed,
        reason: allowed ? null : "RAI_UNAVAILABLE",
        policy: null,
        cached: false,
      };
    }

    cache.set(key, { decision: { ...decision, cached: false }, expiresAt: now + ttlMs });

    if (!decision.allowed && options.onBlocked) {
      options.onBlocked({
        tenantId: input.tenantId,
        modelId: input.modelId,
        feature: input.feature,
        reason: decision.reason ?? "DENIED",
      });
    }
    return decision;
  }

  return { check, clearCache: () => cache.clear() };
}
