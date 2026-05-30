/**
 * Scheduled baseline-recalibration job (EPIC 2 batch counterpart).
 *
 * The adaptive runner already consumes recalibrated difficulty live, but a
 * periodic batch gives operators a durable snapshot: per-tenant item
 * health, how many items are calibratable, how many are flagged or
 * recommended for retirement, and the size of the active calibration map.
 *
 * Pure w.r.t. the repo reads (which go through the persistence layer), so
 * it runs identically on the in-memory store and a future Drizzle/Postgres
 * impl, and is unit-testable without a scheduler.
 */
import { logger } from "@/lib/observability/logger";
import { nowIso } from "@/lib/db/store";
import { getBaselineRecalibration, getBaselineCalibrationMap } from "@/lib/db/repos";

export interface TenantRecalibrationSummary {
  tenantId: string;
  itemsObserved: number;
  calibratable: number;
  flagged: number;
  recommendedForRetire: number;
  calibrationKeys: number;
}

export interface RecalibrationJobResult {
  ranAt: string;
  tenantCount: number;
  tenants: TenantRecalibrationSummary[];
}

export async function runBaselineRecalibrationJob(input: {
  tenantIds: string[];
  minExposure?: number;
}): Promise<RecalibrationJobResult> {
  const tenants: TenantRecalibrationSummary[] = [];
  for (const tenantId of input.tenantIds) {
    const items = await getBaselineRecalibration({ tenantId, minExposure: input.minExposure });
    const calibration = await getBaselineCalibrationMap({ tenantId, minExposure: input.minExposure });
    const summary: TenantRecalibrationSummary = {
      tenantId,
      itemsObserved: items.length,
      calibratable: items.filter((i) => i.sufficientData).length,
      flagged: items.filter((i) => i.defectReasons.length > 0).length,
      recommendedForRetire: items.filter((i) => i.recommendRetire).length,
      calibrationKeys: Object.keys(calibration).length,
    };
    logger.info(
      { event: "baseline.recalibration_job_tenant", ...summary },
      "baseline recalibration job: tenant processed",
    );
    tenants.push(summary);
  }

  const result: RecalibrationJobResult = {
    ranAt: nowIso(),
    tenantCount: tenants.length,
    tenants,
  };
  logger.info(
    {
      event: "baseline.recalibration_job_done",
      tenantCount: result.tenantCount,
      ranAt: result.ranAt,
      flaggedTotal: tenants.reduce((acc, t) => acc + t.flagged, 0),
      retireTotal: tenants.reduce((acc, t) => acc + t.recommendedForRetire, 0),
    },
    "baseline recalibration job complete",
  );
  return result;
}
