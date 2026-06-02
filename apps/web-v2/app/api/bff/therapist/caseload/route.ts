/**
 * Sprint 9 — therapist caseload BFF.
 *
 *   GET /api/bff/therapist/caseload
 *
 * Returns every learner the therapist owns via an ACCEPTED team
 * invite, with active goals, last session, and next-session
 * placeholder. THERAPIST role only.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { listTherapistCaseload } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["therapist"], requestId);
    if (roleErr) return roleErr;
    const caseload = listTherapistCaseload(session!.userId, session!.email, session!.tenantId);
    return ok({ caseload }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
