/**
 * Sprint 10 — caregiver observation authoring.
 *
 *   GET  /api/bff/caregiver/observations?learnerId=...
 *   POST /api/bff/caregiver/observations
 *
 * Caregivers submit structured behaviour observations (ABC: antecedent
 * / behaviour / consequence + duration + location). Submissions also
 * appear in the parent + therapist feeds so the care team has a
 * single source of truth.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { createCaregiverObservation, listCaregiverObservations } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["caregiver", "parent", "therapist", "teacher"],
      requestId,
    );
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
    return ok({ observations: listCaregiverObservations(learnerId, session!.tenantId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["caregiver"], requestId);
    if (roleErr) return roleErr;
    const body = (await req.json().catch(() => null)) as {
      learnerId?: string;
      observedAt?: string;
      behaviour?: string;
      antecedent?: string;
      consequence?: string;
      durationMinutes?: number | null;
      location?: string;
      mood?: string | null;
      attachmentUrl?: string | null;
    } | null;
    if (!body?.learnerId || !body.behaviour) {
      return fail(
        {
          code: "validation_error",
          message: "learnerId and behaviour are required",
          userMessage: "Pick a learner and describe what you noticed.",
          status: 400,
        },
        requestId,
      );
    }
    const obs = createCaregiverObservation({
      tenantId: session!.tenantId,
      learnerId: body.learnerId,
      caregiverUserId: session!.userId,
      observedAt: body.observedAt,
      behaviour: body.behaviour,
      antecedent: body.antecedent,
      consequence: body.consequence,
      durationMinutes: body.durationMinutes,
      location: body.location,
      mood: body.mood,
      attachmentUrl: body.attachmentUrl,
    });
    return ok({ observation: obs }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
