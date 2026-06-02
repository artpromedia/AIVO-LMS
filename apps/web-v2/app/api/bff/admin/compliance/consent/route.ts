import { NextResponse } from "next/server";
import { z } from "zod";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ERRORS } from "@/lib/bff/errors";
import { searchConsents, recordConsent, scopeForSession } from "@/lib/compliance/governance-store";

export const dynamic = "force-dynamic";

const CONSENT_ROLES = ["platform_admin", "district_admin", "school_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...CONSENT_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const subjectId = url.searchParams.get("subjectId") ?? undefined;
    const consentType = url.searchParams.get("consentType") ?? undefined;
    const tenantScope = scopeForSession(session!.role, session!.tenantId);

    const records = searchConsents({ subjectId, consentType, tenantScope });
    return ok({ records }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const recordSchema = z.object({
  subjectId: z.string().min(1).max(256),
  consentType: z.string().min(1).max(128),
  granted: z.boolean(),
  tenantId: z.string().max(128).nullable().optional(),
  actorRole: z.string().max(64).nullable().optional(),
  method: z.string().max(64).nullable().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...CONSENT_ROLES], requestId);
    if (roleErr) return roleErr;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = recordSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }

    const record = recordConsent({
      subjectId: parsed.data.subjectId,
      consentType: parsed.data.consentType,
      granted: parsed.data.granted,
      tenantId: parsed.data.tenantId ?? session!.tenantId,
      actorRole: parsed.data.actorRole ?? session!.role,
      method: parsed.data.method,
    });

    audit(session!, "compliance.consent.recorded", requestId, {
      metadata: {
        consentId: record.id,
        subjectId: record.subjectId,
        consentType: record.consentType,
        granted: record.granted,
      },
    });

    return ok({ record }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
