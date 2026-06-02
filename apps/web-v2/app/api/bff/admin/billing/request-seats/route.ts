import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ERRORS } from "@/lib/bff/errors";
import { audit } from "@/lib/bff/audit";
import { createSeatRequest } from "@/lib/billing/district-pool";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  requestedSeats: z.number().int().positive(),
  justification: z.string().min(1).max(2000),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    // Only school_admin may submit seat requests
    const roleErr = requireRole(session!, ["school_admin"], requestId);
    if (roleErr) return roleErr;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }

    const ticket = createSeatRequest({
      schoolId: session!.tenantId,
      requestedBy: session!.userId,
      requestedSeats: parsed.data.requestedSeats,
      justification: parsed.data.justification,
    });

    audit(session!, "billing.seat_request.created", requestId, {
      metadata: { ticketId: ticket.id, requestedSeats: parsed.data.requestedSeats },
    });

    return ok({ ticket }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
