/**
 * Server-side helper fronting `services/recommendation-svc` from the BFF
 * (adaptive-learning E2E Sprint 5). Browser code MUST NOT import this —
 * always go through an /api/bff/learners/.../recommendations route, which
 * enforces session + parent role + learner scope before proxying.
 *
 * Auth to the upstream: the shared internal service token as the bearer
 * when configured (production), plus the dev x-actor-* headers the
 * enterprise auth hook accepts when NODE_ENV !== production.
 */
import { serverEnv } from "@/lib/env";
import { engineList, engineRespond, type EngineAction } from "@/lib/recommendations/engine";

/**
 * Use the in-memory engine when no real recommendation-svc is wired (no
 * internal service token — i.e. local/dev/test). In production the token is
 * present and we proxy the real upstream.
 */
function recommendationsUseEngine(): boolean {
  return !process.env.RECOMMENDATION_SVC_SERVICE_TOKEN && !process.env.INTERNAL_SERVICE_TOKEN;
}

export interface RecommendationSummary {
  id: string;
  learnerId: string;
  type: string;
  title: string;
  parentSummary: string;
  currentValue: unknown;
  proposedValue: unknown;
  amendedValue?: unknown;
  confidence: number;
  evidence: Array<{
    source: string;
    summary: string;
    metric?: string;
    contributorRole?: string;
  }>;
  safety: {
    requiresParentApproval: boolean;
    affectsIEP: boolean;
    affectsInstructionalAccess: boolean;
    reversible: boolean;
  };
  status: string;
  declineReason?: string;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function headers(session: { userId: string; tenantId: string }): Record<string, string> {
  const token = process.env.RECOMMENDATION_SVC_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_TOKEN;
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    // Dev path: the enterprise hook accepts actor headers outside production.
    "x-actor-id": session.userId,
    "x-actor-role": "parent",
    "x-tenant-id": session.tenantId,
  };
}

export async function listRecommendationsForLearner(
  session: { userId: string; tenantId: string },
  learnerId: string,
): Promise<{ pending: RecommendationSummary[]; decided: RecommendationSummary[] }> {
  if (recommendationsUseEngine()) {
    const all = await engineList(learnerId, session.tenantId);
    return {
      pending: all.filter((r) => r.status === "PENDING"),
      decided: all.filter((r) => r.status !== "PENDING").slice(0, 10),
    };
  }
  let res: Response;
  try {
    res = await fetch(
      `${serverEnv.RECOMMENDATION_SVC_URL}/api/recommendations/learner/${encodeURIComponent(learnerId)}`,
      { headers: headers(session), cache: "no-store" },
    );
  } catch (e) {
    // Network failure (svc down / unreachable / DNS / timeout). `fetch`
    // rejects rather than returning a non-2xx, so without this the error
    // escaped as a raw 500 INTERNAL_ERROR. Surface it as the same
    // "list failed" error the BFF route maps to UPSTREAM_UNAVAILABLE (502,
    // retryable) so the panel shows its graceful "unavailable" state.
    throw new Error(
      `recommendation-svc list failed: ${e instanceof Error ? e.message : "network error"}`,
    );
  }
  if (!res.ok) {
    throw new Error(`recommendation-svc list failed: ${res.status}`);
  }
  const data = (await res.json()) as { recommendations: RecommendationSummary[] };
  const all = data.recommendations ?? [];
  return {
    pending: all.filter((r) => r.status === "PENDING"),
    // Recent history so the panel can show what was applied/declined.
    decided: all.filter((r) => r.status !== "PENDING").slice(0, 10),
  };
}

export type RecommendationAction = "accept" | "amend" | "decline" | "add_context" | "undo";

/** Approver roles the platform supports (Wave C, G5). */
export type RecommendationActorRole = "parent" | "teacher" | "caregiver";

export async function respondToRecommendation(
  session: { userId: string; tenantId: string },
  recId: string,
  action: RecommendationAction,
  opts: {
    amendedValue?: unknown;
    reason?: string;
    context?: string;
    actorRole?: RecommendationActorRole;
    /** Required for the in-memory dev engine; ignored by the upstream proxy. */
    learnerId?: string;
  },
): Promise<{ ok: true; recommendation: RecommendationSummary } | { ok: false; status: number; error: string }> {
  if (recommendationsUseEngine()) {
    if (!opts.learnerId) {
      return { ok: false, status: 400, error: "learnerId required for local engine" };
    }
    const rec = await engineRespond(opts.learnerId, session.tenantId, recId, action as EngineAction, {
      context: opts.context,
      reason: opts.reason,
      amendedValue: opts.amendedValue,
    });
    return rec ? { ok: true, recommendation: rec } : { ok: false, status: 404, error: "not_found" };
  }
  let res: Response;
  try {
    res = await fetch(
      `${serverEnv.RECOMMENDATION_SVC_URL}/api/recommendations/${encodeURIComponent(recId)}/${action}`,
      {
        method: "POST",
        headers: headers(session),
        body: JSON.stringify({
          // recommendation-svc enforces the role × type × tenant-policy matrix
          // (parents always pass; teacher/caregiver only when the district
          // delegated that type) — the BFF just states who is acting.
          actorRole: opts.actorRole ?? "parent",
          amendedValue: opts.amendedValue,
          reason: opts.reason,
          context: opts.context,
        }),
      },
    );
  } catch (e) {
    // Network failure — return a retryable upstream status instead of letting
    // `fetch` reject into an unhandled 500 at the route.
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: String(body.error ?? "upstream_error") };
  }
  return { ok: true, recommendation: body.recommendation as RecommendationSummary };
}
