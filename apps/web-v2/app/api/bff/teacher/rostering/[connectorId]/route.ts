import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireRosteringActor, authorizeRosterTenant } from "@/lib/bff/sis-guard";
import { recordAudit } from "@/lib/db/repos";
import { getConnector, listRuns, deleteConnector } from "@/lib/db/sis-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ connectorId: string }> };

/** GET — connector detail + recent run history (own tenant). */
export async function GET(req: Request, ctx: Ctx) {
  const got = await requireRosteringActor(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const denied = authorizeRosterTenant(session, connector.tenantId, requestId);
  if (denied) return denied;
  return ok({ connector, runs: listRuns(connectorId, 10) }, requestId);
}

/** DELETE — disconnect a roster provider (own tenant). */
export async function DELETE(req: Request, ctx: Ctx) {
  const got = await requireRosteringActor(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const denied = authorizeRosterTenant(session, connector.tenantId, requestId);
  if (denied) return denied;

  deleteConnector(connectorId);
  await recordAudit({
    userId: session.userId,
    tenantId: connector.tenantId,
    action: "rostering.teacher.disconnect",
    metadata: { connectorId, provider: connector.provider },
    requestId,
  });
  return ok({ disconnected: true }, requestId);
}
