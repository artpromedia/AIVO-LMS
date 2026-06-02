import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSisViewer, requireSisManager, authorizeManageTenant } from "@/lib/bff/sis-guard";
import { recordAudit } from "@/lib/db/repos";
import { getConnector, updateConnector, deleteConnector, listRuns } from "@/lib/db/sis-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ connectorId: string }> };

const UpdateSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  fullScheduleCron: z.string().max(60).optional(),
  deltaScheduleCron: z.string().max(60).optional(),
  maxMutationRatio: z.number().min(0.01).max(1).optional(),
  credentialHint: z.string().max(120).nullable().optional(),
  mapping: z
    .object({
      emailDomain: z.string().max(253).optional(),
      studentRole: z.string().max(40).optional(),
      teacherRole: z.string().max(40).optional(),
      gradeMap: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export async function GET(req: Request, ctx: Ctx) {
  const got = await requireSisViewer(req);
  if ("err" in got) return got.err;
  const { requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  return ok({ connector, runs: listRuns(connectorId, 10) }, requestId);
}

async function mutate(req: Request, ctx: Ctx) {
  const got = await requireSisManager(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const denied = authorizeManageTenant(session, connector.tenantId, requestId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." }, requestId);
  }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);

  const updated = updateConnector(connectorId, parsed.data);
  await recordAudit({
    userId: session.userId,
    tenantId: connector.tenantId,
    action: "sis.connector.update",
    metadata: { connectorId, keys: Object.keys(parsed.data) },
    requestId,
  });
  return ok({ connector: updated }, requestId);
}

export const PUT = mutate;
export const PATCH = mutate;

export async function DELETE(req: Request, ctx: Ctx) {
  const got = await requireSisManager(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { connectorId } = await ctx.params;
  const connector = getConnector(connectorId);
  if (!connector) return fail({ ...ERRORS.NOT_FOUND, message: "Connector not found" }, requestId);
  const denied = authorizeManageTenant(session, connector.tenantId, requestId);
  if (denied) return denied;
  deleteConnector(connectorId);
  await recordAudit({
    userId: session.userId,
    tenantId: connector.tenantId,
    action: "sis.connector.delete",
    metadata: { connectorId },
    requestId,
  });
  return ok({ deleted: true }, requestId);
}
