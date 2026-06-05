import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { hashIpFromRequest } from "@/lib/bff/consent-guard";
import { getAgeGateForLearner, listConsentsForLearner, recordConsent } from "@/lib/db/repos";
import { CONSENT_TYPES, type ConsentType } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const PER_LEARNER_TYPES: ConsentType[] = [
  "child_data_collection",
  "iep_document_storage",
  "ai_personalization",
  "teacher_access",
];

export async function GET(req: Request, { params }: Params) {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    return ok(
      {
        records: await listConsentsForLearner(session!.userId, learnerId, session!.tenantId),
        ageGate: await getAgeGateForLearner(learnerId, session!.tenantId),
        applicableTypes: PER_LEARNER_TYPES,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request, { params }: Params) {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const json = (await req.json().catch(() => ({}))) as { consentType?: string };
    if (
      !json.consentType ||
      !(CONSENT_TYPES as readonly string[]).includes(json.consentType) ||
      !PER_LEARNER_TYPES.includes(json.consentType as ConsentType)
    ) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "consentType must be a per-learner consent",
        },
        requestId,
      );
    }
    const rec = await recordConsent({
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      learnerId,
      consentType: json.consentType as ConsentType,
      ipHash: hashIpFromRequest(req),
      userAgent: req.headers.get("user-agent"),
    });
    audit(session, "consent.accept", requestId, {
      learnerId,
      metadata: { consentType: rec.consentType, version: rec.version },
    });
    return ok({ record: rec }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
