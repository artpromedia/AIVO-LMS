import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Admin surface for baseline item calibration analytics.
 *
 * Backed by admin-svc, which aggregates the real Postgres
 * `baseline_item_response_logs` table (@aivo/db). No mock store.
 *
 *   GET /api/admin-svc/baseline/metrics
 *   GET /api/admin-svc/baseline/recalibration
 */

export interface BaselineDifficultyRow {
  difficulty: string;
  responses: number;
  pCorrect: number;
  pSkipped: number;
}

export interface BaselineMetrics {
  windowDays: number;
  totals: {
    responses: number;
    correct: number;
    skipped: number;
    correctRate: number;
    skipRate: number;
    learners: number;
    baselines: number;
    items: number;
    avgLatencyMs: number;
  };
  byDifficulty: BaselineDifficultyRow[];
}

export type RecalibrationRecommendation = "harder" | "easier" | "ok";

export interface BaselineRecalibrationItem {
  itemKey: string;
  skillId: string;
  subjectId: string;
  difficulty: string;
  samples: number;
  pCorrect: number;
  seedTheta: number;
  targetPCorrect: number;
  divergence: number;
  recommendation: RecalibrationRecommendation;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getBaselineMetrics(
  session: Pick<SessionProfile, "role">,
  days?: number,
): Promise<BaselineMetrics> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/baseline/metrics",
    days ? { days } : undefined,
  );
  const totals =
    payload.totals && typeof payload.totals === "object"
      ? (payload.totals as Record<string, unknown>)
      : {};
  const byDifficulty = Array.isArray(payload.byDifficulty) ? payload.byDifficulty : [];
  return {
    windowDays: num(payload.windowDays),
    totals: {
      responses: num(totals.responses),
      correct: num(totals.correct),
      skipped: num(totals.skipped),
      correctRate: num(totals.correctRate),
      skipRate: num(totals.skipRate),
      learners: num(totals.learners),
      baselines: num(totals.baselines),
      items: num(totals.items),
      avgLatencyMs: num(totals.avgLatencyMs),
    },
    byDifficulty: byDifficulty.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        difficulty: String(r.difficulty ?? "unknown"),
        responses: num(r.responses),
        pCorrect: num(r.pCorrect),
        pSkipped: num(r.pSkipped),
      };
    }),
  };
}

export async function listBaselineRecalibration(
  session: Pick<SessionProfile, "role">,
  options: { days?: number; minSample?: number } = {},
): Promise<{ windowDays: number; minSample: number; items: BaselineRecalibrationItem[] }> {
  const query: Record<string, number> = {};
  if (options.days) query.days = options.days;
  if (options.minSample) query.minSample = options.minSample;
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/baseline/recalibration",
    Object.keys(query).length ? query : undefined,
  );
  const rows = Array.isArray(payload.items) ? payload.items : [];
  return {
    windowDays: num(payload.windowDays),
    minSample: num(payload.minSample),
    items: rows.map((row) => {
      const r = row as Record<string, unknown>;
      const rec = String(r.recommendation ?? "ok");
      return {
        itemKey: String(r.itemKey ?? ""),
        skillId: String(r.skillId ?? ""),
        subjectId: String(r.subjectId ?? ""),
        difficulty: String(r.difficulty ?? "unknown"),
        samples: num(r.samples),
        pCorrect: num(r.pCorrect),
        seedTheta: num(r.seedTheta),
        targetPCorrect: num(r.targetPCorrect),
        divergence: num(r.divergence),
        recommendation: (rec === "harder" || rec === "easier"
          ? rec
          : "ok") as RecalibrationRecommendation,
      };
    }),
  };
}
