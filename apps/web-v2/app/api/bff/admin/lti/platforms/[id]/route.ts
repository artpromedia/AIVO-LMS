import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getAdminBearer } from "@/lib/bff/identity-admin";
import { deleteLtiPlatform, updateLtiPlatform } from "@/lib/bff/service-clients/integration";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["platform_admin", "district_admin", "school_admin"] as const;

function rawToken(bearer: string): string {
  return bearer.replace(/^Bearer\s+/i, "");
}

function unavailable(requestId: string, reason: string) {
  return fail({ ...ERRORS.UPSTREAM_UNAVAILABLE, message: reason, status: 502 }, requestId);
}

const putSchema = z.object({
  jwksUrl: z.string().url().optional(),
  authTokenUrl: z.string().url().optional(),
  authLoginUrl: z.string().url().optional(),
  label: z.string().nullable().optional(),
  deployments: z
    .array(z.object({ deploymentId: z.string().min(1), label: z.string().optional() }))
    .optional(),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await ctx.params;
    const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Invalid update payload." },
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
    const r = await updateLtiPlatform(rawToken(bearer), id, parsed.data);
    if (!r.ok) {
      if (r.reason.includes("not found")) {
        return fail({ ...ERRORS.NOT_FOUND, message: r.reason }, requestId);
      }
      return unavailable(requestId, r.reason);
    }
    audit(session!, "lti.platform.updated", requestId, {
      metadata: { platformId: id, fields: Object.keys(parsed.data) },
    });
    return ok(r.data, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await ctx.params;
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
    const r = await deleteLtiPlatform(rawToken(bearer), id);
    if (!r.ok) {
      if (r.reason.includes("not found") || r.reason === "http_404") {
        return fail({ ...ERRORS.NOT_FOUND, message: r.reason }, requestId);
      }
      return unavailable(requestId, r.reason);
    }
    audit(session!, "lti.platform.deleted", requestId, {
      metadata: { platformId: id },
    });
    return ok({ deleted: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
