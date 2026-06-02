/**
 * Public (no-session) DSAR intake endpoint.
 * POST /api/bff/privacy/dsar-request
 *
 * Open — no authentication required. Rate-limiting is handled at the
 * infrastructure layer. The intake creates a DSAR in "intake" status;
 * processor review happens in the admin compliance console.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { audit } from "@/lib/bff/audit";
import {
  createDsar,
  ACK_HOURS,
  type DsarType,
  type Regulation,
} from "@/lib/compliance/governance-store";

export const dynamic = "force-dynamic";

const intakeSchema = z.object({
  type: z.enum(["access", "erasure", "portability", "rectification", "restriction", "objection"]),
  subjectId: z.string().min(1).max(256),
  subjectType: z.string().max(64).optional(),
  subjectEmail: z.string().email().max(256).optional(),
  regulation: z.enum(["gdpr", "ccpa", "ferpa"]).optional(),
  requesterEmail: z.string().email().max(256),
  onBehalfOfMinor: z.boolean().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = intakeSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }

    const dsar = createDsar({
      type: parsed.data.type as DsarType,
      subjectId: parsed.data.subjectId,
      subjectType: parsed.data.subjectType,
      subjectEmail: parsed.data.subjectEmail ?? null,
      regulation: parsed.data.regulation as Regulation | undefined,
      tenantId: null,
      requesterId: null,
      requesterRole: parsed.data.onBehalfOfMinor ? "parent" : "data_subject",
      onBehalfOfMinor: parsed.data.onBehalfOfMinor,
    });

    audit(null, "compliance.dsar.public_intake", requestId, {
      metadata: { dsarId: dsar.id, type: dsar.type, requesterEmail: parsed.data.requesterEmail },
    });

    return ok(
      {
        dsar: {
          id: dsar.id,
          type: dsar.type,
          regulation: dsar.regulation,
          status: dsar.status,
          createdAt: dsar.createdAt,
        },
        sla: {
          ackHours: ACK_HOURS,
          fulfillmentDays: dsar.fulfillmentDays,
        },
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
