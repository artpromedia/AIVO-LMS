import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";
import { getTenantFlags } from "@/lib/bff/tenant-flags";

export const dynamic = "force-dynamic";

/**
 * Sprint B2 — resolved feature flags for the caller's tenant
 * (kill switch > district override > env default). Client components and
 * external app shells read this instead of any env knowledge.
 */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const flags = await getTenantFlags();
    return ok({ tenantId: session!.tenantId, flags }, requestId);
  } catch (err) {
    return failFromUnknown(err, requestId);
  }
}
