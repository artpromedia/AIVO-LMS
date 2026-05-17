import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { createSupportTicket, listSupportTickets } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const scope = adminScopeForSession(session!);
    const tickets = listSupportTickets(scope.tenantIds);
    return ok({ tickets }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** Any signed-in user can file a ticket — scope is their own tenant. */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const ticketBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!subject || subject.length > 200 || !ticketBody) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "subject (<=200) and body are required.",
        },
        requestId,
      );
    }
    const ticket = createSupportTicket({
      userId: session!.userId,
      tenantId: session!.tenantId,
      subject,
      body: ticketBody,
    });
    audit(session!, "support.ticket.create", requestId, {
      metadata: { ticketId: ticket.id },
    });
    return ok({ ticket }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
