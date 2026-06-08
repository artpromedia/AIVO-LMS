import { fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import { buildRoleSession } from "@/lib/auth/role-session";

export const dynamic = "force-dynamic";

/**
 * GET /api/bff/me — Phase 1 unified-identity contract.
 *
 * Returns the canonical {@link RoleSessionPayload} for the signed-in
 * user: `{ id, tenantId, roles[], activeRole, capabilities[] }`. This
 * is the single client-side source of truth ADR 0020 requires; the
 * `<RoleGate>` boundary, the role switcher, and `canAccessArea` all
 * consume this shape directly.
 */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId);
  }
  return ok(buildRoleSession(session), requestId);
}
