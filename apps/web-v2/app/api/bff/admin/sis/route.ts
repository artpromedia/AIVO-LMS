import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSisViewer, requireSisManager, authorizeManageTenant } from "@/lib/bff/sis-guard";
import { recordAudit } from "@/lib/db/repos";
import { listConnectors, createConnector, latestRun } from "@/lib/db/sis-store";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  tenantId: z.string().min(1).max(80),
  provider: z.enum(["oneroster_rest", "oneroster_csv", "clever", "classlink"]),
  displayName: z.string().min(1).max(120),
  credentialHint: z.string().max(120).nullable().optional(),
  maxMutationRatio: z.number().min(0.01).max(1).optional(),
  mapping: z
    .object({
      emailDomain: z.string().max(253).optional(),
      studentRole: z.string().max(40).optional(),
      teacherRole: z.string().max(40).optional(),
      gradeMap: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

/** GET — list connectors in scope, with their latest run summary. */
export async function GET(req: Request) {
  const got = await requireSisViewer(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const scope = session.role === "platform_admin" ? tenantId : session.tenantId;
  const connectors = listConnectors(scope).map((c) => ({ ...c, latestRun: latestRun(c.id) }));
  return ok({ connectors }, requestId);
}

/** POST — create a connector (configure). */
export async function POST(req: Request) {
  const got = await requireSisManager(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." },
      requestId,
    );
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success)
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);

  const denied = authorizeManageTenant(session, parsed.data.tenantId, requestId);
  if (denied) return denied;

  const connector = createConnector(parsed.data);
  await recordAudit({
    userId: session.userId,
    tenantId: parsed.data.tenantId,
    action: "sis.connector.create",
    metadata: { connectorId: connector.id, provider: connector.provider },
    requestId,
  });
  return ok({ connector }, requestId);
}
