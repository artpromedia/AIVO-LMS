/**
 * Sprint 12 — baseline pipeline observability.
 *
 *   GET /api/bff/admin/baseline-metrics
 *
 * Returns aggregate counts the platform admin dashboard needs to
 * answer "is the AI baseline healthy?" without scraping logs:
 *
 *   - total baselines served in window
 *   - source breakdown (ai / ai+fallback / fallback / pre_symbolic)
 *   - responsible-AI block rate
 *   - top violation codes
 *   - p95 lookups when present (placeholder until otel histogram lands)
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { getBaselinePipelineMetrics } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const url = new URL(req.url);
    const startIso = url.searchParams.get("startIso") ?? undefined;
    const endIso = url.searchParams.get("endIso") ?? undefined;
    const metrics = getBaselinePipelineMetrics({ startIso, endIso });
    return ok({ metrics }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
