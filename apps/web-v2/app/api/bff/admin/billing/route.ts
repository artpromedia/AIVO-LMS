import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { getTenantById, listBillingForTenants } from "@/lib/db/repos";
import { ERRORS } from "@/lib/bff/errors";
import { getDistrictSummary, getDistrictPool } from "@/lib/billing/district-pool";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const view = url.searchParams.get("view");
    const tenantId = url.searchParams.get("tenantId");

    // Extended: ?view=summary&tenantId= or ?view=pool&tenantId=
    if ((view === "summary" || view === "pool") && tenantId) {
      // RBAC: platform_admin can see any tenant; district_admin only own
      if (session!.role !== "platform_admin" && session!.tenantId !== tenantId) {
        return fail(
          { ...ERRORS.FORBIDDEN_TENANT, message: "Not allowed to view that tenant." },
          requestId,
        );
      }
      if (view === "summary") {
        return ok({ summary: getDistrictSummary(tenantId) }, requestId);
      }
      return ok({ pool: getDistrictPool(tenantId) }, requestId);
    }

    // Default: return all billing accounts in scope
    const scope = adminScopeForSession(session!);
    const accounts = (await listBillingForTenants(scope.tenantIds)).map((a) => ({
      ...a,
      tenantName: getTenantById(a.tenantId)?.name ?? a.tenantId,
    }));
    return ok({ accounts }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
