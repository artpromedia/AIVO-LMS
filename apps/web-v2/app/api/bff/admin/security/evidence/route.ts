import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createControlEvidence } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const schema = z.object({
  controlId: z.string().min(1),
  kind: z.enum(["policy", "log", "config", "screenshot", "report", "runbook", "ticket"]),
  summary: z.string().min(1).max(500),
  uri: z.string().max(500).nullable().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." }, requestId);
    }
    const rec = createControlEvidence({
      controlId: parsed.data.controlId,
      kind: parsed.data.kind,
      summary: parsed.data.summary,
      uri: parsed.data.uri ?? null,
      collectedByUserId: session!.userId,
    });
    if (!rec) return fail({ ...ERRORS.NOT_FOUND, message: "Control not found." }, requestId);
    audit(session!, "security.evidence.collected", requestId, { metadata: { evidenceId: rec.id, controlId: rec.controlId } });
    return ok({ evidence: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
