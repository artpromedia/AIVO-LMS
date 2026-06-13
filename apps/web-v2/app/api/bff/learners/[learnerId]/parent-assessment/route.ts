import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import {
  getOrCreateParentAssessment,
  patchParentAssessmentSection,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import {
  ASSESSMENT_SECTION_ORDER,
  assessmentSectionSchemas,
  validateSection,
  draftValidateSection,
  type AssessmentSectionId,
} from "@/lib/validators/parent-assessment";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const PatchBody = z.object({
  section: z.enum(ASSESSMENT_SECTION_ORDER as [AssessmentSectionId, ...AssessmentSectionId[]]),
  data: z.unknown(),
});

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    const assessment = getOrCreateParentAssessment(learnerId, session!.tenantId);
    return ok({ assessment }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/**
 * Apply a single-section patch to the parent-assessment draft.
 *
 * `mode: "draft"` (PATCH — field-level autosave, Sprint C-11) validates only
 * the touched section and tolerates a partial/half-filled section (draft ≠
 * submit): every field is optional but each field's type/bounds are enforced,
 * unknown keys are stripped. Autosave only ever advances the draft.
 *
 * `mode: "strict"` (POST — section-commit parity with the server action)
 * requires the full section shape, exactly as before.
 */
async function applyPatch(
  req: Request,
  learnerId: string,
  requestId: string,
  mode: "draft" | "strict",
): Promise<NextResponse> {
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent"], requestId);
  if (roleErr) return roleErr;
  const scope = await requireLearnerScope(session!, learnerId, requestId);
  if (scope) return scope;
  const consentErr = await requireLearnerConsent(
    session!,
    learnerId,
    ["child_data_collection"],
    requestId,
  );
  if (consentErr) return consentErr;

  const body = await req.json().catch(() => ({}));
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }
  const sectionId = parsed.data.section as AssessmentSectionId;
  if (!(sectionId in assessmentSectionSchemas)) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: "Unknown section" }, requestId);
  }
  const v =
    mode === "draft"
      ? draftValidateSection(sectionId, parsed.data.data)
      : validateSection(sectionId, parsed.data.data);
  if (!v.ok) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: v.message }, requestId);
  }
  const next = await patchParentAssessmentSection(learnerId, session!.tenantId, sectionId, v.data);
  await refreshLearnerReadiness(learnerId, session!.tenantId);
  audit(session, "parent_assessment.section.patch", requestId, {
    learnerId,
    metadata: { section: sectionId, draft: mode === "draft" },
  });
  return ok({ assessment: next, savedAt: next.updatedAt }, requestId);
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    return await applyPatch(req, learnerId, requestId, "strict");
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    // Field-level autosave: draft-lenient so a half-filled section persists.
    return await applyPatch(req, learnerId, requestId, "draft");
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
