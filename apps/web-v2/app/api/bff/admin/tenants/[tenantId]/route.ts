import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { getTenantById, updateTenant } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tenantId: string }> };

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { tenantId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const scope = adminScopeForSession(session!);
    if (!scope.tenantIds.includes(tenantId)) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Tenant not found." }, requestId);
    }
    if (!getTenantById(tenantId)) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Tenant not found." }, requestId);
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : null;
    if (!name || name.length === 0 || name.length > 120) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "name is required (1-120 chars)." },
        requestId,
      );
    }
    const tenant = updateTenant(tenantId, { name });
    audit(session!, "admin.tenant.update", requestId, {
      metadata: { tenantId },
    });
    return ok({ tenant }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
