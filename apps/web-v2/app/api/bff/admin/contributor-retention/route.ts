/**
 * Sprint C-16 — the contributor retention read-path (the DoD metric's query
 * surface).
 *
 *   GET /api/bff/admin/contributor-retention?windowDays=60
 *
 * Returns the repeat-contribution rate for the caller's tenant: of contributors
 * whose input was ACKNOWLEDGED, the share who contributed AGAIN within
 * `windowDays` (default 60), with a per-role breakdown. The computation rides
 * the durable, queryable read-paths C-14's funnel uses (the acknowledgement
 * records + the `contribution.submitted` audit rows) — no dashboard, no
 * warehouse, just a computable rate (matching where C-14 put its funnel).
 *
 * Admin-scoped: a non-admin caller gets 403 (the same `ADMIN_ROLES` guard the
 * baseline-metrics analytics read uses).
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { computeContributorRetentionForTenant } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const raw = new URL(req.url).searchParams.get("windowDays");
    const parsed = raw != null ? Number(raw) : 60;
    const windowDays =
      Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? Math.floor(parsed) : 60;

    const retention = await computeContributorRetentionForTenant({
      tenantId: session!.tenantId,
      windowDays,
    });
    return ok({ retention }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
