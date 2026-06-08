import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createIncident, listIncidents, listIncidentTimeline } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const incidents = (await listIncidents()).map((i) => ({
      incident: i,
      timeline: listIncidentTimeline(i.id),
    }));
    return ok({ incidents }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const schema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(2000),
  severity: z.enum(["sev1", "sev2", "sev3", "sev4"]),
  customerImpact: z.boolean().default(false),
  regulatorNotificationRequired: z.boolean().default(false),
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
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const inc = await createIncident({ ...parsed.data, commanderUserId: session!.userId });
    audit(session!, "security.incident.opened", requestId, {
      metadata: { incidentId: inc.id, severity: inc.severity },
    });
    return ok({ incident: inc }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
