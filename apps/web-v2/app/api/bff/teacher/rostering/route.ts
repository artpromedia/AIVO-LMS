import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import {
  requireRosteringActor,
  resolveRosterTenant,
  authorizeRosterTenant,
} from "@/lib/bff/sis-guard";
import { recordAudit } from "@/lib/db/repos";
import { listConnectors, createConnector, latestRun } from "@/lib/db/sis-store";

export const dynamic = "force-dynamic";

/**
 * Teacher rostering BFF.
 *
 * Mirrors the admin SIS surface (`/api/bff/admin/sis`) but is reachable
 * by teachers for their own tenant only (see `requireRosteringActor` +
 * `authorizeRosterTenant`). Backed by the same in-memory `sis-store`, so
 * the swap to a live integration-svc proxy is mechanical.
 */

const CreateSchema = z.object({
  provider: z.enum(["google_classroom", "clever", "classlink", "oneroster_rest", "oneroster_csv"]),
  displayName: z.string().min(1).max(120),
  // Non-secret hint only (e.g. masked client id / account email). Secrets
  // are never accepted or stored here.
  credentialHint: z.string().max(120).nullable().optional(),
  mapping: z
    .object({
      emailDomain: z.string().max(253).optional(),
      studentRole: z.string().max(40).optional(),
      teacherRole: z.string().max(40).optional(),
    })
    .optional(),
});

/** GET — list this teacher's tenant connectors with their latest run. */
export async function GET(req: Request) {
  const got = await requireRosteringActor(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const url = new URL(req.url);
  const tenantId = resolveRosterTenant(session, url.searchParams.get("tenantId") ?? undefined);
  const connectors = listConnectors(tenantId).map((c) => ({ ...c, latestRun: latestRun(c.id) }));
  return ok({ tenantId, connectors }, requestId);
}

/** POST — connect (configure) a roster provider for this teacher's tenant. */
export async function POST(req: Request) {
  const got = await requireRosteringActor(req);
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

  const tenantId = resolveRosterTenant(session);
  const denied = authorizeRosterTenant(session, tenantId, requestId);
  if (denied) return denied;

  const connector = createConnector({
    tenantId,
    provider: parsed.data.provider,
    displayName: parsed.data.displayName,
    credentialHint: parsed.data.credentialHint ?? null,
    mapping: parsed.data.mapping,
  });
  await recordAudit({
    userId: session.userId,
    tenantId,
    action: "rostering.teacher.connect",
    metadata: { connectorId: connector.id, provider: connector.provider },
    requestId,
  });
  return ok({ connector }, requestId);
}
