import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ackBrainProfileChange, recordChildProfileDisclosure } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const bodySchema = z.object({
  changeId: z.string().min(1),
});

/**
 * POST /api/bff/learners/:learnerId/brain-changes/ack
 *
 * Sprint C-13 — acknowledge a pending STRUCTURAL change to a learner's brain
 * profile (the parent has seen the delta). Parent-scoped + audited:
 *
 *   - non-parent role → 403 (requireRole), enforced server-side, not just in UI;
 *   - the parent must own the learner (requireLearnerScope);
 *   - the ack is idempotent and refuses a non-pending / non-structural change
 *     (returns 404 so a forged id can't flip anything);
 *   - the act is recorded in the audit trail AND the FERPA disclosure trail
 *     (per C-12 conventions) — acknowledging a structural delta is a recorded
 *     parent act over child brain data.
 */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    // Trust rule: only a parent may acknowledge. A teacher/admin/other role is 403.
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." },
        requestId,
      );
    }

    const change = await ackBrainProfileChange(parsed.data.changeId, learnerId, session!.tenantId);
    if (!change) {
      // Unknown id, wrong learner/tenant, or not a pending structural change.
      return fail(
        { ...ERRORS.NOT_FOUND, message: "No pending change to acknowledge." },
        requestId,
      );
    }

    audit(session, "brain_profile_change.acknowledge", requestId, {
      learnerId,
      metadata: { changeId: change.id, revision: change.revision, source: change.source },
    });
    // C-12 — record the acknowledgement in the FERPA disclosure trail (a
    // recorded parent act over child brain data). Best-effort; a disclosure
    // write must never fail the ack the parent just made.
    await recordChildProfileDisclosure({
      tenantId: session!.tenantId,
      learnerId,
      readerUserId: session!.userId,
      readerRole: "parent",
      surface: "web-v2:POST /api/bff/learners/{learnerId}/brain-changes/ack",
      dataClass: "brain_profile_change",
    }).catch(() => {});

    return ok({ change }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
