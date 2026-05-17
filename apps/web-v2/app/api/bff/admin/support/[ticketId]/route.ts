import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { updateSupportTicketStatus } from "@/lib/db/repos";
import type { SupportTicket } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketId: string }> };

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { ticketId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const status = body.status as SupportTicket["status"] | undefined;
    if (!status || !["open", "in_progress", "resolved"].includes(status)) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "status must be one of open|in_progress|resolved.",
        },
        requestId,
      );
    }
    const scope = adminScopeForSession(session!);
    const updated = updateSupportTicketStatus(ticketId, status, {
      tenantIds: scope.tenantIds,
    });
    if (!updated) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Ticket not found." }, requestId);
    }
    audit(session!, "support.ticket.update", requestId, {
      metadata: { ticketId, status },
    });
    return ok({ ticket: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
