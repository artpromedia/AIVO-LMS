import { NextResponse } from "next/server";
import { z } from "zod";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { ERRORS } from "@/lib/bff/errors";
import {
  listDsars,
  computeKpis,
  slaFor,
  createDsar,
  scopeForSession,
  type DsarStatus,
  type DsarType,
  type Regulation,
} from "@/lib/compliance/governance-store";

export const dynamic = "force-dynamic";

const PROCESSOR_ROLES = ["platform_admin", "district_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...PROCESSOR_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as DsarStatus | null;
    const tenantScope = scopeForSession(session!.role, session!.tenantId);

    const list = listDsars({ status: status ?? undefined, tenantScope });
    const kpis = computeKpis(list);
    const requests = list.map((d) => ({ ...d, sla: slaFor(d) }));

    return ok({ requests, kpis }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const intakeSchema = z.object({
  type: z.enum(["access", "erasure", "portability", "rectification", "restriction", "objection"]),
  subjectId: z.string().min(1).max(256),
  subjectType: z.string().max(64).optional(),
  subjectEmail: z.string().email().max(256).nullable().optional(),
  regulation: z.enum(["gdpr", "ccpa", "ferpa"]).optional(),
  tenantId: z.string().max(128).nullable().optional(),
  requesterRole: z.string().max(64).nullable().optional(),
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

    // POST is open for anonymous intake — no session required.
    // If a session is present, use it to fill in requesterId.
    const { session } = await requireSession(req, requestId);

    const dsar = createDsar({
      type: parsed.data.type as DsarType,
      subjectId: parsed.data.subjectId,
      subjectType: parsed.data.subjectType,
      subjectEmail: parsed.data.subjectEmail ?? null,
      regulation: parsed.data.regulation as Regulation | undefined,
      tenantId: parsed.data.tenantId ?? session?.tenantId ?? null,
      requesterId: session?.userId ?? null,
      requesterRole: parsed.data.requesterRole ?? session?.role ?? null,
      onBehalfOfMinor: parsed.data.onBehalfOfMinor,
    });

    audit(session ?? null, "compliance.dsar.intake", requestId, {
      metadata: { dsarId: dsar.id, type: dsar.type, regulation: dsar.regulation },
    });

    return ok({ dsar }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
