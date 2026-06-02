import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ERRORS } from "@/lib/bff/errors";
import { listDistrictInvoices } from "@/lib/billing/district-pool";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    const roleErr = requireRole(session!, ["platform_admin", "district_admin"], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    if (!tenantId) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "tenantId query param is required." },
        requestId,
      );
    }

    // RBAC: platform_admin any; district_admin only own tenant
    if (session!.role !== "platform_admin" && session!.tenantId !== tenantId) {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "Not allowed to view invoices for that tenant." },
        requestId,
      );
    }

    const invoices = listDistrictInvoices(tenantId, { from, to });
    return ok({ invoices }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
