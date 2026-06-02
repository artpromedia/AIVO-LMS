/**
 * Sprint 9 — therapist session-note CRUD.
 *
 *   GET  /api/bff/therapist/sessions?learnerId=...
 *   POST /api/bff/therapist/sessions
 *   POST /api/bff/therapist/sessions?action=sign&id=...
 *
 * Notes are SOAP-templated (Subjective, Objective, Assessment, Plan)
 * and link to one or more IEP goal ids so progress trends update.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { createSessionNote, listSessionNotes, signSessionNote } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["therapist", "parent"], requestId);
    if (roleErr) return roleErr;
    const learnerId = new URL(req.url).searchParams.get("learnerId");
    if (!learnerId)
      return fail(
        {
          code: "validation_error",
          message: "learnerId is required",
          userMessage: "Pick a learner first.",
          status: 400,
        },
        requestId,
      );
    return ok({ notes: listSessionNotes(learnerId, session!.tenantId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["therapist"], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "sign") {
      const id = url.searchParams.get("id");
      if (!id)
        return fail(
          {
            code: "validation_error",
            message: "id is required",
            userMessage: "Session id is required.",
            status: 400,
          },
          requestId,
        );
      const note = signSessionNote(id, session!.tenantId);
      if (!note)
        return fail(
          {
            code: "not_found",
            message: "Session note not found",
            userMessage: "That session is not on your caseload.",
            status: 404,
          },
          requestId,
        );
      return ok({ note }, requestId);
    }

    const body = (await req.json().catch(() => null)) as {
      learnerId?: string;
      sessionDate?: string;
      durationMinutes?: number;
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      goalIds?: string[];
    } | null;
    if (!body?.learnerId || typeof body.durationMinutes !== "number") {
      return fail(
        {
          code: "validation_error",
          message: "learnerId and durationMinutes are required",
          userMessage: "Add a learner and session duration before saving.",
          status: 400,
        },
        requestId,
      );
    }
    const note = createSessionNote({
      tenantId: session!.tenantId,
      learnerId: body.learnerId,
      therapistUserId: session!.userId,
      sessionDate: body.sessionDate,
      durationMinutes: body.durationMinutes,
      subjective: body.subjective ?? "",
      objective: body.objective ?? "",
      assessment: body.assessment ?? "",
      plan: body.plan ?? "",
      goalIds: body.goalIds ?? [],
    });
    return ok({ note }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
