import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { revokeConsent } from "@/lib/db/repos";
import { CONSENT_TYPES, type ConsentType } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ consentType: string }> };

export async function POST(req: Request, { params }: Params) {
  const requestId = getRequestId(req);
  const { consentType } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    if (!(CONSENT_TYPES as readonly string[]).includes(consentType)) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Unknown consent type" },
        requestId,
      );
    }
    const json = (await req.json().catch(() => ({}))) as {
      learnerId?: string | null;
    };
    const rec = revokeConsent({
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      learnerId: json.learnerId ?? null,
      consentType: consentType as ConsentType,
    });
    if (!rec) {
      return fail(
        { ...ERRORS.NOT_FOUND, message: "No active consent to revoke" },
        requestId,
      );
    }
    audit(session, "consent.revoke", requestId, {
      learnerId: rec.learnerId,
      metadata: { consentType: rec.consentType, version: rec.version },
    });
    return ok({ record: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
