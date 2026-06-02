import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getAdminBearer } from "@/lib/bff/identity-admin";
import { listLtiPlatforms, registerLtiPlatform } from "@/lib/bff/service-clients/integration";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["platform_admin", "district_admin", "school_admin"] as const;

/** Strip the "Bearer " prefix — integration-svc clients take a raw token. */
function rawToken(bearer: string): string {
  return bearer.replace(/^Bearer\s+/i, "");
}

function unavailable(requestId: string, reason: string) {
  return fail({ ...ERRORS.UPSTREAM_UNAVAILABLE, message: reason, status: 502 }, requestId);
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const bearer = await getAdminBearer();
    if (!bearer) {
      // Mock auth / no real token — nothing to list from the real registry.
      return ok({ platforms: [], count: 0 }, requestId);
    }
    const r = await listLtiPlatforms(rawToken(bearer));
    if (!r.ok) return unavailable(requestId, r.reason);
    return ok(r.data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const postSchema = z.object({
  issuer: z.string().min(1),
  clientId: z.string().min(1),
  jwksUrl: z.string().url(),
  authTokenUrl: z.string().url(),
  authLoginUrl: z.string().url(),
  label: z.string().optional(),
  deployments: z
    .array(z.object({ deploymentId: z.string().min(1), label: z.string().optional() }))
    .optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "issuer, clientId and the JWKS/OAuth URLs are required.",
        },
        requestId,
      );
    }

    const bearer = await getAdminBearer();
    if (!bearer) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: "LTI registration requires a real admin session.",
          status: 503,
        },
        requestId,
      );
    }
    const r = await registerLtiPlatform(rawToken(bearer), parsed.data);
    if (!r.ok) return unavailable(requestId, r.reason);
    audit(session!, "lti.platform.registered", requestId, {
      metadata: { issuer: parsed.data.issuer, clientId: parsed.data.clientId },
    });
    return ok(r.data, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
