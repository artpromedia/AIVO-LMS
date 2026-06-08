import { fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import { getTenant } from "@/lib/auth/tenants";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId);
  }
  const tenant = getTenant(session.tenantId);
  return ok(
    {
      session,
      tenant,
      authenticatedAt: new Date().toISOString(),
    },
    requestId,
  );
}
