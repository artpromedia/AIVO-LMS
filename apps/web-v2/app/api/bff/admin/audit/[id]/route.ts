import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireAuditViewer } from "@/lib/bff/audit-guard";
import { getAuditEvent } from "@/lib/db/audit-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — single event; hash-chain proof omitted for roles without proof rights. */
export async function GET(req: Request, ctx: Ctx) {
  const got = await requireAuditViewer(req);
  if ("err" in got) return got.err;
  const { scope, requestId } = got;
  const { id } = await ctx.params;

  const found = getAuditEvent(id);
  if (!found) return fail({ ...ERRORS.NOT_FOUND, message: "Audit event not found" }, requestId);

  // Tenant/school isolation on the single-event view.
  if (scope.tenantId && found.event.tenant_id !== scope.tenantId) {
    return fail({ ...ERRORS.FORBIDDEN_TENANT, message: "Out of scope" }, requestId);
  }
  if (scope.schoolId && found.event.school_id !== scope.schoolId) {
    return fail({ ...ERRORS.FORBIDDEN_TENANT, message: "Out of scope" }, requestId);
  }

  return ok({ event: found.event, proof: scope.canViewProof ? found.proof : null }, requestId);
}
