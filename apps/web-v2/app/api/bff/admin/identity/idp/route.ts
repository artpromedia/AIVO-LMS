import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireIdentityAdmin, authorizeTenant } from "@/lib/bff/identity-guard";
import { recordAudit } from "@/lib/db/repos";
import { listIdpConfigs, upsertIdpConfig } from "@/lib/db/idp-store";

export const dynamic = "force-dynamic";

const AttributeMappingSchema = z.object({
  email: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(120).optional(),
  role: z.string().min(1).max(120).optional(),
  roleMap: z.record(z.string(), z.string()).optional(),
  defaultRole: z.string().min(1).max(60).optional(),
});

const UpsertSchema = z.object({
  id: z.string().max(80).optional(),
  tenantId: z.string().min(1).max(80),
  enabled: z.boolean().optional(),
  protocol: z.enum(["saml", "oidc"]),
  idpLabel: z.string().min(1).max(120),
  issuer: z.string().max(1000).nullable().optional(),
  metadataUrl: z.string().url().max(1000).nullable().optional(),
  clientId: z.string().max(255).nullable().optional(),
  emailDomains: z.array(z.string().max(253)).max(50).optional(),
  jitProvisioning: z.boolean().optional(),
  attributeMapping: AttributeMappingSchema.optional(),
  scimEnabled: z.boolean().optional(),
});

/** GET /api/bff/admin/identity/idp?tenantId=… — list IdP configs in scope. */
export async function GET(req: Request) {
  const got = await requireIdentityAdmin(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;

  // district_admin is always constrained to its own tenant regardless of the
  // query param; platform_admin sees the requested tenant or all of them.
  const scopeTenant =
    session.role === "district_admin" ? session.tenantId : tenantId;
  if (session.role === "district_admin" && tenantId && tenantId !== session.tenantId) {
    return fail(
      { ...ERRORS.FORBIDDEN_TENANT, message: "Cannot list other tenants" },
      requestId,
    );
  }
  return ok({ configs: listIdpConfigs(scopeTenant) }, requestId);
}

/** POST /api/bff/admin/identity/idp — create or update an IdP config. */
export async function POST(req: Request) {
  const got = await requireIdentityAdmin(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." }, requestId);
  }
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }

  const denied = authorizeTenant(session, parsed.data.tenantId, requestId);
  if (denied) return denied;

  const record = upsertIdpConfig({ ...parsed.data, actorId: session.userId });

  await recordAudit({
    userId: session.userId,
    tenantId: parsed.data.tenantId,
    action: parsed.data.id ? "identity.idp.update" : "identity.idp.create",
    metadata: { idpId: record.id, protocol: record.protocol, enabled: record.enabled },
    requestId,
  });

  return ok({ config: record }, requestId);
}
