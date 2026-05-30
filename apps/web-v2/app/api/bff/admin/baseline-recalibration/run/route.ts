/**
 * Trigger the scheduled baseline-recalibration job.
 *
 *   GET  — cron entrypoint. Authenticated with `CRON_SECRET`
 *          (`Authorization: Bearer <secret>`); processes ALL tenants.
 *          Wire to a platform scheduler / Vercel cron.
 *   POST — manual trigger by a platform/district/school admin; processes
 *          the tenants in the admin's scope.
 *
 * Returns the per-tenant recalibration summary (item health, flagged /
 * retire counts, calibration-map size).
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok, fail } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { scopeTenantsForSession } from "@/lib/db/repos";
import { runBaselineRecalibrationJob } from "@/lib/jobs/recalibrate-baseline";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return fail(
        {
          status: 401,
          code: "unauthorized",
          message: "cron auth required",
          userMessage: "Not authorized.",
        },
        requestId,
      );
    }
    // Cron runs platform-wide.
    const tenantIds = scopeTenantsForSession("platform_admin", "").map((t) => t.id);
    const result = await runBaselineRecalibrationJob({ tenantIds });
    return ok({ result }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const tenantIds = scopeTenantsForSession(session!.role, session!.tenantId).map((t) => t.id);
    const result = await runBaselineRecalibrationJob({ tenantIds });
    return ok({ result }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
