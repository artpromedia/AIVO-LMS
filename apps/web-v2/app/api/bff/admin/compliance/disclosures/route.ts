import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listDisclosures, recordDisclosure, getLearner } from "@/lib/db/repos";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  learnerId: z.string().min(1).max(64).nullable().optional(),
  recipientType: z.enum([
    "school_official",
    "auditor",
    "law_enforcement",
    "parent",
    "court_order",
    "ferpa_directory",
    "other",
  ]),
  recipientName: z.string().min(1).max(200),
  reason: z.string().min(1).max(2000),
  ferpaBasis: z.string().min(1).max(200),
});

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    return ok({ disclosures: listDisclosures(session!.tenantId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }
    // FERPA record integrity: when a disclosure references a learner the
    // record must point at a learner actually in this tenant. Without this
    // check a disclosure can reference an arbitrary string, which weakens
    // the audit trail and could mask cross-tenant references.
    const learnerId = parsed.data.learnerId ?? null;
    if (learnerId && !getLearner(learnerId, session!.tenantId)) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "learnerId not found in this tenant.",
        },
        requestId,
      );
    }
    const rec = recordDisclosure({
      tenantId: session!.tenantId,
      learnerId,
      recipientType: parsed.data.recipientType,
      recipientName: parsed.data.recipientName,
      reason: parsed.data.reason,
      ferpaBasis: parsed.data.ferpaBasis,
      disclosedByUserId: session!.userId,
    });
    audit(session!, "compliance.disclosure.recorded", requestId, {
      learnerId,
      metadata: {
        disclosureId: rec.id,
        recipientType: rec.recipientType,
        ferpaBasis: rec.ferpaBasis,
      },
    });
    return ok({ disclosure: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
