/**
 * Sprint 11 — IEP draft review queue for the teacher role.
 *
 *   GET  /api/bff/teacher/iep-drafts                — list drafts on roster
 *   GET  /api/bff/teacher/iep-drafts?learnerId=...  — single draft
 *   POST /api/bff/teacher/iep-drafts                — upsert from ai-svc
 *   POST /api/bff/teacher/iep-drafts?action=progress&id=...&to=teacher_review
 *
 * The POST surface accepts a body matching IepAiDraftBody so the
 * caller (typically the assessment-svc IEP draft proxy) can land the
 * structured AI response directly without bespoke transforms.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import {
  getIepAiDraft,
  listIepAiDraftsForReviewer,
  progressIepAiDraft,
  upsertIepAiDraft,
} from "@/lib/db/repos";
import type { IepAiDraftBody, IepAiDraftStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS: IepAiDraftStatus[] = [
  "ai_draft",
  "teacher_review",
  "admin_approved",
  "active",
  "archived",
];

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher", "school_admin", "district_admin"], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const learnerId = url.searchParams.get("learnerId");
    if (learnerId) {
      const draft = await getIepAiDraft(learnerId, session!.tenantId);
      return ok({ draft }, requestId);
    }
    const drafts = listIepAiDraftsForReviewer(session!.userId, session!.tenantId);
    return ok({ drafts }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher", "school_admin", "district_admin"], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "progress") {
      const id = url.searchParams.get("id");
      const to = url.searchParams.get("to") as IepAiDraftStatus | null;
      if (!id || !to || !ALLOWED_STATUS.includes(to)) {
        return fail(
          {
            code: "validation_error",
            message: "id and a valid `to` status are required",
            userMessage: "Missing draft id or target status.",
            status: 400,
          },
          requestId,
        );
      }
      const updated = await progressIepAiDraft(id, session!.tenantId, session!.userId, to);
      if (!updated) {
        return fail(
          {
            code: "not_found_or_invalid_transition",
            message: `Draft ${id} not found or transition to ${to} not allowed`,
            userMessage: "That status change isn't allowed from this state.",
            status: 409,
          },
          requestId,
        );
      }
      return ok({ draft: updated }, requestId);
    }

    const body = (await req.json().catch(() => null)) as {
      learnerId?: string;
      draft?: IepAiDraftBody;
      model?: string;
      sourceAttemptId?: string | null;
      responsibleAi?: Record<string, unknown>;
    } | null;
    if (!body?.learnerId || !body.draft) {
      return fail(
        {
          code: "validation_error",
          message: "learnerId and draft are required",
          userMessage: "Provide a learner id and a draft payload.",
          status: 400,
        },
        requestId,
      );
    }
    const draft = await upsertIepAiDraft({
      tenantId: session!.tenantId,
      learnerId: body.learnerId,
      sourceAttemptId: body.sourceAttemptId ?? null,
      draft: body.draft,
      model: body.model,
      responsibleAi: body.responsibleAi,
    });
    return ok({ draft }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
