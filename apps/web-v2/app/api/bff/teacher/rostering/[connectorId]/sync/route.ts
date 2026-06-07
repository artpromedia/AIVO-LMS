import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import {
  requireRosteringActor,
  authorizeRosterTenant,
  requireRosterConnectGrant,
} from "@/lib/bff/sis-guard";
import { recordAudit } from "@/lib/db/repos";
import { getConnector, listRuns, triggerRun } from "@/lib/db/sis-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ connectorId: string }> };

const RunSchema = z.object({
  type: z.enum(["full", "delta"]).default("full"),
  dryRun: z.boolean().optional(),
});

/** GET — run history for this connector (own tenant). */
export async function GET(req: Request, ctx: Ctx) {
  const got = await requireRosteringActor(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const denied = authorizeRosterTenant(session, connector.tenantId, requestId);
  if (denied) return denied;
  return ok({ runs: listRuns(connectorId, 10) }, requestId);
}

/** POST — trigger a manual roster sync (own tenant). */
export async function POST(req: Request, ctx: Ctx) {
  const got = await requireRosteringActor(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const denied = authorizeRosterTenant(session, connector.tenantId, requestId);
  if (denied) return denied;
  const ungranted = await requireRosterConnectGrant(session, connector.tenantId, requestId);
  if (ungranted) return ungranted;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body allowed — defaults to a full sync */
  }
  const parsed = RunSchema.safeParse(body ?? {});
  if (!parsed.success)
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);

  const run = triggerRun(connectorId, parsed.data.type, parsed.data.dryRun ?? false);
  await recordAudit({
    userId: session.userId,
    tenantId: connector.tenantId,
    action: "rostering.teacher.sync",
    metadata: { connectorId, type: parsed.data.type, runId: run?.id, status: run?.status },
    requestId,
  });
  return ok({ run }, requestId);
}
