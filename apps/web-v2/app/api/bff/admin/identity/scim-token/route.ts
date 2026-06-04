import { z } from "zod";
import { fail, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireIdentityAdmin, authorizeTenant } from "@/lib/bff/identity-guard";
import { recordAudit } from "@/lib/db/repos";
import { getIdpConfig, issueScimToken, revokeScimToken } from "@/lib/db/idp-store";

export const dynamic = "force-dynamic";

const IssueSchema = z.object({
  idpId: z.string().min(1).max(80),
  label: z.string().max(120).optional(),
});

const RevokeSchema = z.object({
  idpId: z.string().min(1).max(80),
  tokenId: z.string().min(1).max(80),
});

/** POST — issue a new SCIM bearer token (full value returned exactly once). */
export async function POST(req: Request) {
  const got = await requireIdentityAdmin(req);
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
  const parsed = IssueSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }

  const config = getIdpConfig(parsed.data.idpId);
  if (!config) return fail({ ...ERRORS.NOT_FOUND, message: "IdP config not found" }, requestId);
  const denied = authorizeTenant(session, config.tenantId, requestId);
  if (denied) return denied;

  const issued = issueScimToken(config.id, parsed.data.label ?? "SCIM token", session.userId);
  if (!issued) return fail({ ...ERRORS.NOT_FOUND, message: "IdP config not found" }, requestId);

  await recordAudit({
    userId: session.userId,
    tenantId: config.tenantId,
    action: "identity.scim_token.issue",
    metadata: { idpId: config.id, tokenId: issued.preview.id },
    requestId,
  });

  // The plaintext `token` is included once; the client must surface it
  // immediately and never persist it server-side.
  return ok({ token: issued.token, preview: issued.preview }, requestId);
}

/** DELETE — revoke an existing SCIM token. */
export async function DELETE(req: Request) {
  const got = await requireIdentityAdmin(req);
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
  const parsed = RevokeSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }

  const config = getIdpConfig(parsed.data.idpId);
  if (!config) return fail({ ...ERRORS.NOT_FOUND, message: "IdP config not found" }, requestId);
  const denied = authorizeTenant(session, config.tenantId, requestId);
  if (denied) return denied;

  const revoked = revokeScimToken(config.id, parsed.data.tokenId);
  if (!revoked) {
    return fail({ ...ERRORS.NOT_FOUND, message: "Token not found or already revoked" }, requestId);
  }

  await recordAudit({
    userId: session.userId,
    tenantId: config.tenantId,
    action: "identity.scim_token.revoke",
    metadata: { idpId: config.id, tokenId: parsed.data.tokenId },
    requestId,
  });
  return ok({ revoked: true }, requestId);
}
