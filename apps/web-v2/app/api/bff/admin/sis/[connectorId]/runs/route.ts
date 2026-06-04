import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSisViewer, requireSisManager, authorizeManageTenant } from "@/lib/bff/sis-guard";
import { recordAudit } from "@/lib/db/repos";
import { getConnector, listRuns, triggerRun } from "@/lib/db/sis-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ connectorId: string }> };

const RunSchema = z.object({
  type: z.enum(["full", "delta"]).default("full"),
  dryRun: z.boolean().optional(),
});

/** GET — run history (current + last N). */
export async function GET(req: Request, ctx: Ctx) {
  const got = await requireSisViewer(req);
  if ("err" in got) return got.err;
  const { requestId } = got;
  const { connectorId } = await ctx.params;
  if (!getConnector(connectorId))
    return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  return ok({ runs: listRuns(connectorId, 10) }, requestId);
}

/** POST — trigger a manual full or delta sync. */
export async function POST(req: Request, ctx: Ctx) {
  const got = await requireSisManager(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const denied = authorizeManageTenant(session, connector.tenantId, requestId);
  if (denied) return denied;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is allowed — defaults to a full sync */
  }
  const parsed = RunSchema.safeParse(body ?? {});
  if (!parsed.success)
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);

  const run = triggerRun(connectorId, parsed.data.type, parsed.data.dryRun ?? false);
  await recordAudit({
    userId: session.userId,
    tenantId: connector.tenantId,
    action: "sis.sync.trigger",
    metadata: {
      connectorId,
      type: parsed.data.type,
      dryRun: parsed.data.dryRun ?? false,
      runId: run?.id,
      status: run?.status,
      counts: run?.counts,
    },
    requestId,
  });
  return ok({ run }, requestId);
}
