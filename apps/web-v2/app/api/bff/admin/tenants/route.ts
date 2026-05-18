import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import { createTenant, scopeTenantsForSession } from "@/lib/db/repos";
import type { Tenant } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const tenants = scopeTenantsForSession(session!.role, session!.tenantId);
    return ok({ tenants }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = body.type as Tenant["type"] | undefined;
    const parentTenantId = typeof body.parentTenantId === "string" ? body.parentTenantId : null;
    if (
      !name ||
      name.length > 120 ||
      !type ||
      !["family", "school", "district", "platform"].includes(type)
    ) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "name and type (family|school|district|platform) are required.",
        },
        requestId,
      );
    }
    const tenant = createTenant({ name, type, parentTenantId });
    audit(session!, "admin.tenant.create", requestId, {
      metadata: { tenantId: tenant.id, type },
    });
    return ok({ tenant }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
