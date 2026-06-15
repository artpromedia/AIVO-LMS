import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { listMessageableContacts } from "@/lib/messaging/contacts";

export const dynamic = "force-dynamic";

/**
 * The people this parent may start a thread with — accepted care-team members
 * (teacher / therapist / caregiver / coach) across their learners. Drives the
 * compose recipient picker; the compose route re-validates the chosen pairing.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;

    const contacts = await listMessageableContacts(session!.userId, session!.tenantId);
    return ok({ contacts }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
