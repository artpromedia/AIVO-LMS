/**
 * Downstream link to the local mastery model (mastery-svc), P0.
 *
 * When the model flag is on, the lesson's delivery level + mastery signals come LIVE from the
 * knowledge-tracing model instead of the static `curriculum_alignment` heuristic — the model decides
 * the *level*, the LLM decides the *words*. Returns null when the flag is off, the subject/grade can't
 * be resolved, the model has no data for this learner/subject yet, or the service is unreachable; the
 * caller then falls back to the existing grade-target resolution, so flag-off behaviour is unchanged.
 *
 * The θ→band step reuses @aivo/scoring `deliveryLevelFromTheta` — the SAME policy assessment-svc and
 * learning-svc already use — so the model never invents its own placement bands.
 */
import { canonicalSubjectKey, deliveryLevelFromTheta, normalizeGradeBand, type GradeBand } from "@aivo/scoring";

const MASTERY_SVC_URL = process.env.MASTERY_SVC_URL ?? "http://localhost:3067";
const INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN ||
  (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-token");

function masteryModelEnabled(): boolean {
  const v = String(process.env.AIVO_MASTERY_MODEL_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on" || v === "enabled";
}

function thetaFromP(p: number): number {
  const clamped = Math.min(0.9999, Math.max(0.0001, p));
  return Math.log(clamped / (1 - clamped));
}

export interface ModelDelivery {
  deliveryLevel: string;
  currentMastery: number;
  masteryTrend: string;
}

export async function resolveModelDelivery(input: {
  learnerId: string;
  subject: string;
  enrolledBand: string;
}): Promise<ModelDelivery | null> {
  if (!masteryModelEnabled()) return null;
  const subjectKey = canonicalSubjectKey(input.subject);
  const enrolled = normalizeGradeBand(input.enrolledBand);
  if (!subjectKey || !enrolled) return null;

  try {
    const res = await fetch(
      `${MASTERY_SVC_URL}/api/mastery/${encodeURIComponent(input.learnerId)}?subject=${encodeURIComponent(subjectKey)}`,
      {
        headers: {
          accept: "application/json",
          "x-internal-service": "learning-svc",
          "x-service-token": INTERNAL_SERVICE_TOKEN,
        },
      },
    );
    if (!res.ok) return null;
    const skills = (await res.json()) as Record<string, { p?: number; theta?: number; trend?: string }>;
    const entries = Object.values(skills ?? {});
    if (entries.length === 0) return null; // model has no data yet → fall back

    const meanP = entries.reduce((sum, s) => sum + (s.p ?? 0), 0) / entries.length;
    const deliveryLevel = deliveryLevelFromTheta(thetaFromP(meanP), enrolled as GradeBand);

    const trendCounts: Record<string, number> = {};
    for (const s of entries) {
      const t = s.trend ?? "stable";
      trendCounts[t] = (trendCounts[t] ?? 0) + 1;
    }
    const masteryTrend =
      Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "stable";

    return { deliveryLevel, currentMastery: Number(meanP.toFixed(4)), masteryTrend };
  } catch {
    return null;
  }
}
