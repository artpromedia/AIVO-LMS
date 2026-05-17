import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";
import { getBillingForTenant, getTenantById } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

/**
 * GET /api/bff/billing — the signed-in user's tenant billing snapshot.
 * Available to every role (parents see family plan, admins see their tenant's
 * plan). A null `account` means no billing has been provisioned yet — clients
 * render the "start trial" CTA in that case rather than treating it as error.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const account = getBillingForTenant(session!.tenantId);
    const tenant = getTenantById(session!.tenantId);
    return ok({ account, tenantName: tenant?.name ?? null }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
