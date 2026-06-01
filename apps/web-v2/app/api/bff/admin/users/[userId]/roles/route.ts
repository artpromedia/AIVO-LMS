import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  isIdentitySvcEnabled,
  getAdminBearer,
  listUserRolesSvc,
  grantUserRoleSvc,
  revokeUserRoleSvc,
} from "@/lib/bff/identity-admin";
import {
  isGrantableRole,
  listAdditionalRoles,
  grantRole,
  revokeRole,
} from "@/lib/db/user-roles-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };
const ADMIN_ROLES = ["platform_admin", "district_admin", "school_admin"] as const;

function upstreamFail(requestId: string, status: number, message: string) {
  return fail(
    { ...ERRORS.UPSTREAM_UNAVAILABLE, message, status: status >= 500 ? 502 : status },
    requestId,
  );
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { userId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const bearer = await getAdminBearer();
    if (isIdentitySvcEnabled() && bearer) {
      const r = await listUserRolesSvc(bearer, userId);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
      return ok(r.data, requestId);
    }
    return ok({ additionalRoles: listAdditionalRoles(userId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const postSchema = z.object({
  role: z.enum(["parent", "teacher", "caregiver", "therapist", "learner"]),
});

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { userId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "Unsupported role." }, requestId);
    }
    const role = parsed.data.role;

    const bearer = await getAdminBearer();
    if (isIdentitySvcEnabled() && bearer) {
      const r = await grantUserRoleSvc(bearer, userId, role);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
    } else {
      if (!isGrantableRole(role)) {
        return fail({ ...ERRORS.VALIDATION_FAILED, message: "Unsupported role." }, requestId);
      }
      grantRole(userId, role);
    }
    audit(session!, "admin.user_role.granted", requestId, {
      metadata: { targetUserId: userId, role },
    });
    return ok({ granted: true, role }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { userId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const role = url.searchParams.get("role") ?? "";
    if (!role) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "role is required." }, requestId);
    }

    const bearer = await getAdminBearer();
    if (isIdentitySvcEnabled() && bearer) {
      const r = await revokeUserRoleSvc(bearer, userId, role);
      if (!r.ok) return upstreamFail(requestId, r.status, r.error);
    } else {
      revokeRole(userId, role);
    }
    audit(session!, "admin.user_role.revoked", requestId, {
      metadata: { targetUserId: userId, role },
    });
    return ok({ revoked: true, role }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
