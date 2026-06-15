import { NextResponse } from "next/server";
import { failFromUnknown, fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { failSession } from "@/lib/bff/session-errors";
import {
  parentCanAccessLearner,
  listSessionsForLearner,
  getProvider,
  getLearner,
  bookSession,
} from "@/lib/db/repos";
import { notifySessionUpcoming } from "@/lib/parent/session-notify";
import type { CoachingSession, SessionLocation } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };
const LOCATIONS: SessionLocation[] = ["video", "in_person", "phone"];

function toDto(s: CoachingSession, tenantId: string) {
  const provider = getProvider(s.providerId, tenantId);
  return {
    id: s.id,
    learnerId: s.learnerId,
    providerId: s.providerId,
    providerName: provider?.displayName ?? s.title,
    kind: s.kind,
    specialty: provider?.specialty ?? null,
    title: s.title,
    scheduledStart: s.scheduledStart,
    durationMinutes: s.durationMinutes,
    location: s.location,
    status: s.status,
    feedback: s.feedback,
    cancelReason: s.cancelReason,
    canManage: s.status === "scheduled",
  };
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { learnerId } = await params;
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    if (!(await parentCanAccessLearner(session!.userId, learnerId, session!.tenantId))) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "not your learner" }, requestId);
    }
    const sessions = listSessionsForLearner(learnerId, session!.tenantId).map((s) =>
      toDto(s, session!.tenantId),
    );
    return ok({ sessions }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { learnerId } = await params;
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;

    const json = (await req.json().catch(() => ({}))) as {
      providerId?: unknown;
      scheduledStart?: unknown;
      durationMinutes?: unknown;
      location?: unknown;
      title?: unknown;
    };
    const providerId = typeof json.providerId === "string" ? json.providerId : "";
    const scheduledStart = typeof json.scheduledStart === "string" ? json.scheduledStart : "";
    const durationMinutes = typeof json.durationMinutes === "number" ? json.durationMinutes : 0;
    const location = LOCATIONS.includes(json.location as SessionLocation)
      ? (json.location as SessionLocation)
      : "video";
    const title = typeof json.title === "string" ? json.title : undefined;
    if (!providerId || !scheduledStart || !durationMinutes) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "providerId, scheduledStart, durationMinutes required" },
        requestId,
      );
    }

    const result = await bookSession({
      parentUserId: session!.userId,
      tenantId: session!.tenantId,
      learnerId,
      providerId,
      scheduledStart,
      durationMinutes,
      location,
      title,
    });
    if (!result.ok) return failSession(result, requestId);

    const learner = await getLearner(learnerId, session!.tenantId);
    const provider = getProvider(providerId, session!.tenantId);
    await notifySessionUpcoming({
      parentUserId: session!.userId,
      learnerName: learner?.displayName ?? "your learner",
      providerName: provider?.displayName ?? "your provider",
    });
    audit(session, "session.book", requestId, {
      learnerId,
      metadata: { providerId, scheduledStart, durationMinutes },
    });
    return ok({ session: toDto(result.session, session!.tenantId) }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
