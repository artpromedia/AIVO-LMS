/**
 * Sprint 1 (Enterprise Identity) — step-up enforcement middleware.
 *
 * Two complementary guards:
 *
 *   - `requireStepUp(scope)` — the scope-bound, single-use step-up gate
 *     (re-exported from `routes/step-up.ts`, the single source of truth).
 *     Use this on sensitive *write* endpoints: it requires a fresh
 *     `x-step-up-token` minted for that exact scope.
 *
 *   - `requireRecentMfa({ ttlSec })` — a lighter guard that simply requires
 *     the caller to have completed a second factor within a configurable
 *     window (default 5 min). It inspects the step-up token's `amr`
 *     (must include `mfa`) and `iat` recency, independent of the token's
 *     own expiry. On failure it returns 401 with
 *     `WWW-Authenticate: StepUp` so the web client's `lib/auth/stepUp.ts`
 *     interceptor can route the user through the MFA challenge UI.
 *
 * TTL precedence: explicit `ttlSec` option > `STEP_UP_RECENT_MFA_TTL_SEC`
 * env var > 300 seconds.
 */
import { verifyJWT, ADMIN_ENTERPRISE, type StepUpJWT } from "@aivo/security";
import { AMR_MFA } from "../lib/jwt.js";

export { requireStepUp } from "../routes/step-up.js";

export const DEFAULT_RECENT_MFA_TTL_SEC = 300;

export function resolveRecentMfaTtl(explicit?: number): number {
  if (typeof explicit === "number" && explicit > 0) return explicit;
  const env = Number(process.env.STEP_UP_RECENT_MFA_TTL_SEC);
  if (Number.isFinite(env) && env > 0) return env;
  return DEFAULT_RECENT_MFA_TTL_SEC;
}

/** A verified step-up token augmented with the assurance-context claims. */
export type StepUpTokenClaims = StepUpJWT & {
  amr?: string[];
  iat?: number;
};

export interface RecentMfaResult {
  ok: boolean;
  reason?: "no-amr-mfa" | "stale" | "no-iat";
}

/**
 * Pure predicate: does this verified token represent an MFA event within
 * `ttlSec` of `nowSec`? Exported for unit testing without an HTTP context.
 */
export function isRecentMfa(
  claims: StepUpTokenClaims,
  ttlSec: number,
  nowSec: number,
): RecentMfaResult {
  if (!Array.isArray(claims.amr) || !claims.amr.includes(AMR_MFA)) {
    return { ok: false, reason: "no-amr-mfa" };
  }
  if (typeof claims.iat !== "number") return { ok: false, reason: "no-iat" };
  if (nowSec - claims.iat > ttlSec) return { ok: false, reason: "stale" };
  return { ok: true };
}

export interface RequireRecentMfaOptions {
  /** Override the recency window (seconds). */
  ttlSec?: number;
}

/**
 * Fastify preHandler factory. Rejects requests whose caller has not
 * completed MFA recently. Flag-gated by `ADMIN_ENTERPRISE.STEP_UP_AUTH` so
 * it can ship ahead of the rollout flip as a no-op.
 */
export function requireRecentMfa(opts: RequireRecentMfaOptions = {}) {
  const ttlSec = resolveRecentMfaTtl(opts.ttlSec);
  return async function recentMfaPreHandler(req: any, reply: any) {
    if (!ADMIN_ENTERPRISE.STEP_UP_AUTH) return; // flag-gated rollout

    const challenge = () =>
      reply
        .header("WWW-Authenticate", "StepUp")
        .status(401)
        .send({ error: "Recent MFA required", code: "STEP_UP_REQUIRED" });

    const callerSub: string | undefined = req.user?.sub;
    if (!callerSub) return challenge();

    const token = (req.headers["x-step-up-token"] || "") as string;
    if (!token) return challenge();

    let claims: StepUpTokenClaims;
    try {
      claims = await verifyJWT<StepUpTokenClaims>(token);
    } catch {
      return challenge();
    }
    if (claims.sub !== callerSub) return challenge();

    const nowSec = Math.floor(Date.now() / 1000);
    if (!isRecentMfa(claims, ttlSec, nowSec).ok) return challenge();

    (req as any).recentMfa = claims;
  };
}
