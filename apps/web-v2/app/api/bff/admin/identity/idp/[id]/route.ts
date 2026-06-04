import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireIdentityAdmin, authorizeTenant } from "@/lib/bff/identity-guard";
import { recordAudit } from "@/lib/db/repos";
import { getIdpConfig, upsertIdpConfig, deleteIdpConfig } from "@/lib/db/idp-store";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  protocol: z.enum(["saml", "oidc"]).optional(),
  idpLabel: z.string().min(1).max(120).optional(),
  issuer: z.string().max(1000).nullable().optional(),
  metadataUrl: z.string().url().max(1000).nullable().optional(),
  clientId: z.string().max(255).nullable().optional(),
  emailDomains: z.array(z.string().max(253)).max(50).optional(),
  jitProvisioning: z.boolean().optional(),
  attributeMapping: z
    .object({
      email: z.string().min(1).max(120).optional(),
      name: z.string().min(1).max(120).optional(),
      role: z.string().min(1).max(120).optional(),
      roleMap: z.record(z.string(), z.string()).optional(),
      defaultRole: z.string().min(1).max(60).optional(),
    })
    .optional(),
  scimEnabled: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const got = await requireIdentityAdmin(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { id } = await ctx.params;

  const config = getIdpConfig(id);
  if (!config) return fail({ ...ERRORS.NOT_FOUND, message: "IdP config not found" }, requestId);
  const denied = authorizeTenant(session, config.tenantId, requestId);
  if (denied) return denied;
  return ok({ config }, requestId);
}

async function update(req: Request, ctx: Ctx) {
  const got = await requireIdentityAdmin(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { id } = await ctx.params;

  const config = getIdpConfig(id);
  if (!config) return fail({ ...ERRORS.NOT_FOUND, message: "IdP config not found" }, requestId);
  const denied = authorizeTenant(session, config.tenantId, requestId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." },
      requestId,
    );
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }

  const record = upsertIdpConfig({
    id: config.id,
    tenantId: config.tenantId,
    protocol: parsed.data.protocol ?? config.protocol,
    idpLabel: parsed.data.idpLabel ?? config.idpLabel,
    enabled: parsed.data.enabled,
    issuer: parsed.data.issuer,
    metadataUrl: parsed.data.metadataUrl,
    clientId: parsed.data.clientId,
    emailDomains: parsed.data.emailDomains,
    jitProvisioning: parsed.data.jitProvisioning,
    attributeMapping: parsed.data.attributeMapping,
    scimEnabled: parsed.data.scimEnabled,
    actorId: session.userId,
  });

  await recordAudit({
    userId: session.userId,
    tenantId: config.tenantId,
    action: "identity.idp.update",
    metadata: { idpId: config.id },
    requestId,
  });
  return ok({ config: record }, requestId);
}

export const PUT = update;
export const PATCH = update;

export async function DELETE(req: Request, ctx: Ctx) {
  const got = await requireIdentityAdmin(req);
  if ("err" in got) return got.err;
  const { session, requestId } = got;
  const { id } = await ctx.params;

  const config = getIdpConfig(id);
  if (!config) return fail({ ...ERRORS.NOT_FOUND, message: "IdP config not found" }, requestId);
  const denied = authorizeTenant(session, config.tenantId, requestId);
  if (denied) return denied;

  deleteIdpConfig(id);
  await recordAudit({
    userId: session.userId,
    tenantId: config.tenantId,
    action: "identity.idp.delete",
    metadata: { idpId: id },
    requestId,
  });
  return ok({ deleted: true }, requestId);
}
