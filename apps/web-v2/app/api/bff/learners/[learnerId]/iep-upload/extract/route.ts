import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import {
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  logIepAccess,
  refreshLearnerReadiness,
  setIEPExtraction,
} from "@/lib/db/repos";
import { buildIEPExtraction } from "@/lib/learner/iep";
import { iepExtractionSchema } from "@/lib/validators/iep";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["iep_document_storage", "child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;

    const learner = await getLearner(learnerId, session!.tenantId);
    if (!learner) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const doc = await getIEPForLearner(learnerId, session!.tenantId);
    if (!doc) {
      return fail({ ...ERRORS.PRECONDITION_FAILED, message: "No IEP uploaded yet" }, requestId);
    }
    const assessment = await getOrCreateParentAssessment(learnerId, session!.tenantId);
    // Gate on a submitted assessment: extraction reads from assessment fields,
    // so an unfinished one produces a hollow IEPExtraction. The IEP step is
    // only reachable after assessment submission anyway, but defending the
    // endpoint independently means a stray call can't poison the stored data.
    if (!assessment.submittedAt) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "Submit the parent assessment before extracting accommodations from the IEP.",
        },
        requestId,
      );
    }
    const candidate = buildIEPExtraction({
      learner,
      assessment,
      hasUploadedDocument: true,
    });
    const v = iepExtractionSchema.safeParse(candidate);
    if (!v.success) {
      return fail(
        { ...ERRORS.INTERNAL_ERROR, message: `Extraction failed schema: ${v.error.message}` },
        requestId,
      );
    }
    const next = await setIEPExtraction(learnerId, session!.tenantId, v.data);
    await refreshLearnerReadiness(learnerId, session!.tenantId);
    logIepAccess({
      tenantId: session!.tenantId,
      learnerId,
      documentId: doc.id,
      accessedByUserId: session!.userId,
      purpose: "extract",
    });
    audit(session, "iep.extract", requestId, {
      learnerId,
      metadata: { source: v.data.source, accommodations: v.data.accommodations.length },
    });
    return ok({ document: next }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
