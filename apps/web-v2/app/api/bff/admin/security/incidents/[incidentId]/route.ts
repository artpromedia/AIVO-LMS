import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  appendIncidentTimeline,
  getIncident,
  listIncidentTimeline,
  updateIncident,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["open", "investigating", "mitigating", "resolved", "post_mortem"]).optional(),
  severity: z.enum(["sev1", "sev2", "sev3", "sev4"]).optional(),
  summary: z.string().min(1).max(2000).optional(),
  customerImpact: z.boolean().optional(),
  regulatorNotificationRequired: z.boolean().optional(),
  // Optional appended timeline note in the same request.
  note: z.object({
    kind: z.enum(["detection", "investigation", "mitigation", "communication", "resolution", "note"]),
    message: z.string().min(1).max(1000),
  }).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ incidentId: string }> }): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const { incidentId } = await ctx.params;
    if (!getIncident(incidentId)) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Incident not found." }, requestId);
    }
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." }, requestId);
    }
    const { note, ...patch } = parsed.data;
    const updated = updateIncident(incidentId, patch);
    if (note) {
      const tev = appendIncidentTimeline({
        incidentId,
        authorUserId: session!.userId,
        kind: note.kind,
        message: note.message,
      });
      // Audit the timeline addition separately so the post-mortem can
      // reconstruct who wrote what without grovelling through incident
      // .updated metadata.
      audit(session!, "security.incident.timeline.appended", requestId, {
        metadata: { incidentId, timelineEventId: tev?.id, kind: note.kind },
      });
    }
    audit(session!, "security.incident.updated", requestId, { metadata: { incidentId } });
    return ok({ incident: updated, timeline: listIncidentTimeline(incidentId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
