import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { serverEnv } from "@/lib/env";
import { isMockAuthAllowed } from "@/lib/auth/mock-session";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ email: z.string().email().max(255) });

/**
 * Sprint B1 — SSO discovery proxy. The login form asks "does this email's
 * domain belong to a district with SSO?" and identity-svc answers with the
 * (relative, same-origin) IdP login URL — OIDC preferred, SAML fallback.
 * Unauthenticated by design; identity never reveals whether a specific
 * ACCOUNT exists, only whether a DOMAIN is SSO-managed.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    if (isMockAuthAllowed()) {
      // Mock mode has no identity-svc; password is the only path.
      return ok({ mode: "password" }, requestId);
    }
    const res = await fetch(`${serverEnv.IDENTITY_SVC_URL}/api/auth/discover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    if (!res.ok) {
      return ok({ mode: "password" }, requestId); // discovery is best-effort
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return ok(
      {
        mode: json.mode === "sso" ? "sso" : "password",
        ssoLoginUrl: typeof json.ssoLoginUrl === "string" ? json.ssoLoginUrl : undefined,
        idpLabel: typeof json.idpLabel === "string" ? json.idpLabel : undefined,
        requireSso: Boolean(json.requireSso),
      },
      requestId,
    );
  } catch (err) {
    return failFromUnknown(err, requestId);
  }
}
