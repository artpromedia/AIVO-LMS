import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Admin oversight surface for IEPs.
 *
 * Backed by admin-svc, which reads the real Postgres IEP tables (@aivo/db).
 * Read-only — the IEP authoring/evaluation flow owns the writes. No mock store.
 *
 *   GET /api/admin-svc/iep/evaluations   (role-scoped: district → own tenant)
 *   GET /api/admin-svc/iep/profiles       (platform admins only)
 */

export interface IepEvaluation {
  id: string;
  learnerId: string;
  tenantId: string | null;
  status: string;
  referralReason: string | null;
  decisionEligible: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface IepEvaluationQueue {
  counts: Record<string, number>;
  evaluations: IepEvaluation[];
}

export interface IepProfileReview {
  id: string;
  learnerId: string;
  gradeLevel: string | null;
  placement: string | null;
  lifecycleState: string;
  reviewDate: string | null;
  revisionCounter: number;
}

export interface IepProfilesReview {
  counts: Record<string, number>;
  reviewDue: number;
  profiles: IepProfileReview[];
}

function mapCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(raw);
    out[key] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

export async function listIepEvaluations(
  session: Pick<SessionProfile, "role">,
): Promise<IepEvaluationQueue> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/iep/evaluations",
  );
  const rows = Array.isArray(payload.evaluations) ? payload.evaluations : [];
  return {
    counts: mapCounts(payload.counts),
    evaluations: rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        learnerId: String(r.learnerId ?? ""),
        tenantId: r.tenantId ? String(r.tenantId) : null,
        status: String(r.status ?? "draft"),
        referralReason: r.referralReason ? String(r.referralReason) : null,
        decisionEligible: r.decisionEligible ? String(r.decisionEligible) : null,
        submittedAt: r.submittedAt ? String(r.submittedAt) : null,
        decidedAt: r.decidedAt ? String(r.decidedAt) : null,
        createdAt: r.createdAt ? String(r.createdAt) : null,
        updatedAt: r.updatedAt ? String(r.updatedAt) : null,
      };
    }),
  };
}

export async function getIepProfilesReview(
  session: Pick<SessionProfile, "role">,
): Promise<IepProfilesReview> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/iep/profiles");
  const rows = Array.isArray(payload.profiles) ? payload.profiles : [];
  return {
    counts: mapCounts(payload.counts),
    reviewDue: Number(payload.reviewDue) || 0,
    profiles: rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        learnerId: String(r.learnerId ?? ""),
        gradeLevel: r.gradeLevel ? String(r.gradeLevel) : null,
        placement: r.placement ? String(r.placement) : null,
        lifecycleState: String(r.lifecycleState ?? "finalised"),
        reviewDate: r.reviewDate ? String(r.reviewDate) : null,
        revisionCounter: Number(r.revisionCounter) || 0,
      };
    }),
  };
}
