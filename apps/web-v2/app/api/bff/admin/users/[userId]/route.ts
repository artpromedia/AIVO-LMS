import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { listUsersForTenants, updateUserDisplayName } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { userId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    // Confirm the target user lives inside the admin's tenant scope before
    // touching them — prevents school admins editing district admin records.
    const scope = adminScopeForSession(session!);
    const inScope = listUsersForTenants(scope.tenantIds).some((u) => u.user.id === userId);
    if (!inScope) {
      return fail({ ...ERRORS.NOT_FOUND, message: "User not found." }, requestId);
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;
    if (!displayName || displayName.length > 120) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "displayName is required (1-120)." },
        requestId,
      );
    }
    const user = updateUserDisplayName(userId, displayName);
    audit(session!, "admin.user.update", requestId, { metadata: { userId } });
    return ok({ user }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
