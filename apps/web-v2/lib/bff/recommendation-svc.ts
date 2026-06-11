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
  const res = await fetch(
    `${serverEnv.RECOMMENDATION_SVC_URL}/api/recommendations/learner/${encodeURIComponent(learnerId)}`,
    { headers: headers(session), cache: "no-store" },
  );
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

export type RecommendationAction = "accept" | "amend" | "decline";

export async function respondToRecommendation(
  session: { userId: string; tenantId: string },
  recId: string,
  action: RecommendationAction,
  opts: { amendedValue?: unknown; reason?: string },
): Promise<{ ok: true; recommendation: RecommendationSummary } | { ok: false; status: number; error: string }> {
  const res = await fetch(
    `${serverEnv.RECOMMENDATION_SVC_URL}/api/recommendations/${encodeURIComponent(recId)}/${action}`,
    {
      method: "POST",
      headers: headers(session),
      body: JSON.stringify({
        actorRole: "parent",
        amendedValue: opts.amendedValue,
        reason: opts.reason,
      }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: String(body.error ?? "upstream_error") };
  }
  return { ok: true, recommendation: body.recommendation as RecommendationSummary };
}
