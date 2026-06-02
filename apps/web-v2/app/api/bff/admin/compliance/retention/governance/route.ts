import { NextResponse } from "next/server";
import { z } from "zod";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ERRORS } from "@/lib/bff/errors";
import {
  listRetentionPolicies,
  setRetentionPolicy,
  previewRetention,
  type Disposition,
} from "@/lib/compliance/governance-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;

    const policies = listRetentionPolicies();
    const withPreview = policies.map((p) => ({
      ...p,
      preview: previewRetention(p.dataClass),
    }));
    return ok({ policies: withPreview }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const putSchema = z.object({
  dataClass: z.string().min(1).max(128),
  retentionDays: z
    .number()
    .int()
    .min(0)
    .max(365 * 100)
    .nullable()
    .optional(),
  disposition: z.enum(["purge", "anonymize"]),
  legalHold: z.boolean().optional(),
});

export async function PUT(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }

    const updated = setRetentionPolicy({
      dataClass: parsed.data.dataClass,
      retentionDays: parsed.data.retentionDays ?? null,
      disposition: parsed.data.disposition as Disposition,
      legalHold: parsed.data.legalHold,
    });

    audit(session!, "compliance.retention.governance.updated", requestId, {
      metadata: {
        dataClass: updated.dataClass,
        retentionDays: updated.retentionDays,
        disposition: updated.disposition,
        legalHold: updated.legalHold,
      },
    });

    return ok({ policy: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
