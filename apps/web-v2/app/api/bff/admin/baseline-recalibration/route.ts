/**
 * Adaptive baseline psychometrics + recalibration (EPIC 5 / EPIC 2 loop).
 *
 *   GET /api/bff/admin/baseline-recalibration?minExposure=5
 *
 * Returns per-item psychometrics aggregated from the tenant's live
 * baseline telemetry: exposure, p-value, skip-rate, a refined difficulty
 * estimate (1-PL conditional MLE), the suggested difficulty band, and
 * misfit / auto-retire flags. This is the data layer for the admin
 * "are these items behaving as calibrated?" view and the input to the
 * authoring-review queue.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { getBaselineRecalibration } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const rawMin = url.searchParams.get("minExposure");
    const parsedMin = rawMin === null ? undefined : Number.parseInt(rawMin, 10);
    const minExposure =
      parsedMin !== undefined && Number.isFinite(parsedMin) && parsedMin > 0
        ? parsedMin
        : undefined;

    const items = getBaselineRecalibration({ tenantId: session!.tenantId, minExposure });

    // Headline rollups so the dashboard doesn't re-derive them client-side.
    const summary = {
      itemKeys: items.length,
      calibratable: items.filter((i) => i.sufficientData).length,
      flagged: items.filter((i) => i.defectReasons.length > 0).length,
      recommendedForRetire: items.filter((i) => i.recommendRetire).length,
    };

    return ok({ summary, items }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
