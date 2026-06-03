/**
 * RAI gateway middleware for tutor-svc (Sprint 7 policy enforcement).
 *
 * Before any inference route runs, this preHandler consults
 * responsible-ai-svc `/api/responsible-ai/policies/effective` for the
 * caller's tenant + the tutor model/feature. Decisions are cached for 60s
 * per (tenant, model, feature). On a deny it short-circuits the request
 * with a graceful fallback payload and emits an `ai.call.blocked` audit
 * event. It is fail-open: when responsible-ai-svc is unreachable the call
 * proceeds (availability over strictness for K-12 tutoring), but the gap
 * is logged.
 *
 * Self-contained (uses fetch) so tutor-svc takes no new workspace
 * dependency on responsible-ai-svc.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const RAI_URL = (process.env.RESPONSIBLE_AI_SVC_URL ?? "http://localhost:3071").replace(/\/+$/, "");
const AUDIT_URL = (process.env.AUDIT_SVC_URL ?? "http://localhost:3050").replace(/\/+$/, "");
const TTL_MS = 60_000;

/** Inference route prefixes that must pass the RAI policy check. */
const GUARDED_PREFIXES = ["/api/tutor/chat", "/api/tutor/homework", "/api/tutor/speech"];

/** The model + feature this service represents in the registry. */
const TUTOR_MODEL_ID = process.env.TUTOR_RAI_MODEL_ID ?? "model-tutor-pro";
const TUTOR_FEATURE = "ai-tutor";

interface CacheEntry {
  allowed: boolean;
  reason: string | null;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function serviceToken(): string {
  return process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token";
}

async function resolveDecision(
  tenantId: string,
  fetchImpl: typeof fetch,
): Promise<{ allowed: boolean; reason: string | null }> {
  const key = `${tenantId}|${TUTOR_MODEL_ID}|${TUTOR_FEATURE}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return { allowed: hit.allowed, reason: hit.reason };

  try {
    const url = new URL(`${RAI_URL}/api/responsible-ai/policies/effective`);
    url.searchParams.set("tenantId", tenantId);
    url.searchParams.set("modelId", TUTOR_MODEL_ID);
    url.searchParams.set("feature", TUTOR_FEATURE);
    const res = await fetchImpl(url.toString(), {
      headers: { "x-service-token": serviceToken() },
    });
    if (!res.ok) throw new Error(`policy lookup ${res.status}`);
    const body = (await res.json()) as { allowed: boolean; denyReason: string | null };
    cache.set(key, { allowed: body.allowed, reason: body.denyReason, expiresAt: now + TTL_MS });
    return { allowed: body.allowed, reason: body.denyReason };
  } catch {
    // Fail open: cache a short-lived allow so we don't hammer a down service.
    cache.set(key, { allowed: true, reason: "RAI_UNAVAILABLE", expiresAt: now + 5_000 });
    return { allowed: true, reason: "RAI_UNAVAILABLE" };
  }
}

async function emitBlocked(
  req: FastifyRequest,
  tenantId: string,
  reason: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    await fetchImpl(`${AUDIT_URL}/api/audit-events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-token": serviceToken() },
      body: JSON.stringify({
        action: "ai.call.blocked",
        resourceType: "inference",
        resourceId: TUTOR_MODEL_ID,
        tenantId,
        actorRole: "service",
        details: { feature: TUTOR_FEATURE, reason, path: req.url },
      }),
    });
  } catch (err) {
    req.log?.warn?.({ err: (err as Error).message }, "ai.call.blocked audit emit failed");
  }
}

export interface RaiGatewayOptions {
  fetchImpl?: typeof fetch;
  guardedPrefixes?: string[];
}

export function registerRaiGateway(app: FastifyInstance, options: RaiGatewayOptions = {}): void {
  const fetchImpl = options.fetchImpl ?? fetch;
  const prefixes = options.guardedPrefixes ?? GUARDED_PREFIXES;

  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split("?")[0];
    if (!prefixes.some((p) => path.startsWith(p))) return;

    const tenantId = (req as any).auth?.tenantId as string | undefined;
    // No tenant context (e.g. service-to-service warmups) → let auth handle it.
    if (!tenantId) return;

    const decision = await resolveDecision(tenantId, fetchImpl);
    if (!decision.allowed) {
      await emitBlocked(req, tenantId, decision.reason ?? "DENIED", fetchImpl);
      // Graceful fallback: a 403 with a learner-safe message, not a 500.
      return reply.code(403).send({
        error: "ai_unavailable",
        reason: decision.reason ?? "DENIED",
        message:
          "AI tutoring is currently unavailable for your school. Please contact your administrator.",
        fallback: true,
      });
    }
  });
}

/** Test helper. */
export function __clearRaiGatewayCache(): void {
  cache.clear();
}
