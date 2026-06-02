import { NextResponse } from "next/server";
import { z } from "zod";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ERRORS } from "@/lib/bff/errors";
import {
  getDsar,
  transitionDsar,
  slaFor,
  buildExportBundle,
  type DsarAction,
} from "@/lib/compliance/governance-store";

export const dynamic = "force-dynamic";

const PROCESSOR_ROLES = ["platform_admin", "district_admin"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...PROCESSOR_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await params;
    const dsar = getDsar(id);
    if (!dsar) {
      return fail({ ...ERRORS.NOT_FOUND, message: `DSAR ${id} not found.` }, requestId);
    }

    const url = new URL(req.url);
    if (url.searchParams.get("download") === "bundle") {
      const bundle = buildExportBundle(dsar);
      return ok({ bundle }, requestId);
    }

    const sla = slaFor(dsar);
    return ok({ request: dsar, timeline: dsar.events, sla }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const actionSchema = z.object({
  action: z.enum(["verify-identity", "assign", "approve", "reject", "fulfill"]),
  method: z.string().max(64).optional(),
  assigneeId: z.string().max(128).optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...PROCESSOR_ROLES], requestId);
    if (roleErr) return roleErr;

    const { id } = await params;
    const dsar = getDsar(id);
    if (!dsar) {
      return fail({ ...ERRORS.NOT_FOUND, message: `DSAR ${id} not found.` }, requestId);
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }

    const result = transitionDsar(
      id,
      parsed.data.action as DsarAction,
      { actorId: session!.userId, actorRole: session!.role },
      {
        method: parsed.data.method,
        assigneeId: parsed.data.assigneeId,
        reason: parsed.data.reason,
      },
    );

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 422;
      return fail(
        {
          code: "PRECONDITION_FAILED",
          message: result.reason,
          userMessage: `Cannot perform action: ${result.reason.replace(/_/g, " ")}.`,
          status,
        },
        requestId,
      );
    }

    audit(session!, `compliance.dsar.${parsed.data.action}`, requestId, {
      metadata: { dsarId: id, action: parsed.data.action },
    });

    return ok({ dsar: result.dsar }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
