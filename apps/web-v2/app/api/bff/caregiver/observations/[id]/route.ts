/**
 * Sprint C-10 — caregiver observation edit (author-only, 15-minute window).
 *
 *   PATCH /api/bff/caregiver/observations/:id
 *
 * Lets the AUTHOR correct an observation they just logged. Enforcement is
 * server-side (Trust rule): the editor must be the author and the edit must
 * land within 15 minutes of creation, or the request is rejected. The prior
 * text is preserved in the observation's edit history so a correction never
 * silently overwrites without a trace. A non-author attempt is a 403.
 *
 * Mirrors the family-svc `PATCH /api/family/observations/:id` route — both
 * surfaces enforce the same ownership + window + history-trace rule.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { updateCaregiverObservation } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { id } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["caregiver"], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => null)) as {
      behaviour?: string;
      antecedent?: string;
      consequence?: string;
      durationMinutes?: number | null;
      location?: string;
      mood?: string | null;
    } | null;
    if (!body) {
      return fail(
        {
          code: "validation_error",
          message: "body required",
          userMessage: "Nothing to save.",
          status: 400,
        },
        requestId,
      );
    }

    const result = updateCaregiverObservation({
      id,
      tenantId: session!.tenantId,
      editorUserId: session!.userId,
      behaviour: typeof body.behaviour === "string" ? body.behaviour.trim() : undefined,
      antecedent: typeof body.antecedent === "string" ? body.antecedent.trim() : undefined,
      consequence: typeof body.consequence === "string" ? body.consequence.trim() : undefined,
      durationMinutes:
        body.durationMinutes === null || typeof body.durationMinutes === "number"
          ? body.durationMinutes
          : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      mood: body.mood === null || typeof body.mood === "string" ? body.mood : undefined,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return fail(
          {
            code: "not_found",
            message: "observation not found",
            userMessage: "We couldn't find that observation.",
            status: 404,
          },
          requestId,
        );
      }
      if (result.reason === "forbidden") {
        // Trust rule: only the author may edit — never a soft success.
        return fail(
          {
            code: "forbidden",
            message: "only the author may edit this observation",
            userMessage: "You can only edit observations you wrote.",
            status: 403,
          },
          requestId,
        );
      }
      // window_expired
      return fail(
        {
          code: "edit_window_expired",
          message: "the 15-minute edit window has passed",
          userMessage: "The 15-minute window to edit this has passed.",
          status: 409,
        },
        requestId,
      );
    }

    audit(session, "caregiver_observation.edit", requestId, {
      learnerId: result.observation.learnerId,
      metadata: { observationId: result.observation.id, edits: result.observation.editHistory.length },
    });
    return ok({ observation: result.observation }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
