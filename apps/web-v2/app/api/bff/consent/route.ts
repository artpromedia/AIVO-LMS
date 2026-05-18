import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { hashIpFromRequest } from "@/lib/bff/consent-guard";
import { listConsentVersions, listConsentsForUser, recordConsent } from "@/lib/db/repos";
import type { ConsentType } from "@/lib/db/types";
import { CONSENT_TYPES } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function isConsentType(v: unknown): v is ConsentType {
  return typeof v === "string" && (CONSENT_TYPES as readonly string[]).includes(v);
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const versions = listConsentVersions();
    const records = listConsentsForUser(session!.userId, session!.tenantId);
    return ok({ versions, records }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const json = (await req.json().catch(() => ({}))) as {
      consentType?: string;
    };
    if (!isConsentType(json.consentType)) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "Unknown consentType" }, requestId);
    }
    const rec = recordConsent({
      tenantId: session!.tenantId,
      parentUserId: session!.userId,
      learnerId: null,
      consentType: json.consentType,
      ipHash: hashIpFromRequest(req),
      userAgent: req.headers.get("user-agent"),
    });
    audit(session, "consent.accept", requestId, {
      metadata: { consentType: rec.consentType, version: rec.version },
    });
    return ok({ record: rec }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
