import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  createSecurityControl,
  listSecurityControls,
  listEvidenceForControl,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const controls = await listSecurityControls();
    const withEvidence = controls.map((c) => ({
      control: c,
      evidence: listEvidenceForControl(c.id),
    }));
    return ok({ controls: withEvidence }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const createSchema = z.object({
  code: z.string().min(1).max(40),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(2000),
  criterion: z.enum([
    "security",
    "availability",
    "processing_integrity",
    "confidentiality",
    "privacy",
  ]),
  owner: z.string().min(1).max(80),
  status: z.enum(["implemented", "partial", "not_started", "not_applicable"]),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const control = await createSecurityControl(parsed.data);
    audit(session!, "security.control.created", requestId, {
      metadata: { controlId: control.id, code: control.code },
    });
    return ok({ control }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
