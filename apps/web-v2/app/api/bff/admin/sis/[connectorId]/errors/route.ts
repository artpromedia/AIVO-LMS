import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSisViewer, requireSisManager, authorizeManageTenant } from "@/lib/bff/sis-guard";
import { recordAudit } from "@/lib/db/repos";
import { getConnector, listErrors, retryError, retryAll } from "@/lib/db/sis-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ connectorId: string }> };

/** GET — paged failed rows (cursor-based). */
export async function GET(req: Request, ctx: Ctx) {
  const got = await requireSisViewer(req);
  if ("err" in got) return got.err;
  const { requestId } = got;
  const { connectorId } = await ctx.params;
  if (!getConnector(connectorId))
    return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const cursor = new URL(req.url).searchParams.get("cursor") ?? undefined;
  const { errors, nextCursor } = listErrors(connectorId, cursor);
  return ok({ errors, nextCursor }, requestId);
}

const RetrySchema = z.object({ errorId: z.string().max(80).optional() });

/** POST — retry a specific failed row, or the whole batch when no id given. */
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
    /* empty body => retry all */
  }
  const parsed = RetrySchema.safeParse(body ?? {});
  if (!parsed.success)
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);

  const retried = parsed.data.errorId
    ? retryError(connectorId, parsed.data.errorId)
      ? 1
      : 0
    : retryAll(connectorId);

  await recordAudit({
    userId: session.userId,
    tenantId: connector.tenantId,
    action: "sis.errors.retry",
    metadata: { connectorId, errorId: parsed.data.errorId ?? null, retried },
    requestId,
  });
  return ok({ retried }, requestId);
}
