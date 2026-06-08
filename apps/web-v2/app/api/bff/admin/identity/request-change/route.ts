import { z } from "zod";
import { fail, ok, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const Schema = z.object({
  message: z.string().min(1).max(2000),
});

/**
 * District-admin "request changes" workflow. District admins get a read-only
 * view of their tenant's IdP configuration and submit change requests that
 * platform admins action. The request is captured as an audit event so it
 * surfaces in the audit trail (and Sprint 3's audit UI).
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId);
  }
  if (session.role !== "district_admin") {
    return fail({ ...ERRORS.FORBIDDEN_ROLE, message: "district_admin required" }, requestId);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(
      { ...ERRORS.VALIDATION_FAILED, message: "Could not read request body." },
      requestId,
    );
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }

  await recordAudit({
    userId: session.userId,
    tenantId: session.tenantId,
    action: "identity.idp.change_requested",
    metadata: { message: parsed.data.message },
    requestId,
  });

  return ok({ submitted: true }, requestId);
}
