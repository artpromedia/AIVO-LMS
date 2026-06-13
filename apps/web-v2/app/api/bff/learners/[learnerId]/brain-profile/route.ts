import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getBrainProfile, recordChildProfileDisclosure } from "@/lib/db/repos";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    // Least privilege: the full brain profile carries disabilitySignals and
    // the parent's private assessment summary, so only the parent may read
    // it here. Teachers get the deliberately role-scoped views served by
    // family-svc (services/family-svc/src/routes/collaboration.ts).
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["ai_personalization", "child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    const profile = await getBrainProfile(learnerId, session!.tenantId);
    if (!profile) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Brain profile not generated yet" }, requestId);
    }
    // Sprint C-12 (ADR 0042) — record the FERPA disclosure for this read. This
    // route returns the full profile (disabilitySignals + private assessment
    // summary), so the read is logged even though it is parent-scoped. Best-
    // effort: a disclosure-write failure must never block the parent's read.
    try {
      await recordChildProfileDisclosure({
        tenantId: session!.tenantId,
        learnerId,
        readerUserId: session!.userId,
        readerRole: session!.role,
        surface: "web-v2:GET /api/bff/learners/{learnerId}/brain-profile",
        dataClass: "brain_profile_full",
      });
    } catch (err) {
      logger.error(
        {
          event: "disclosure.persist_failed",
          requestId,
          learnerId,
          tenantId: session!.tenantId,
          message: err instanceof Error ? err.message : String(err),
        },
        "[disclosure] write failed",
      );
    }
    return ok({ brainProfile: profile }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
