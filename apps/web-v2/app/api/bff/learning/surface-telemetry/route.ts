/**
 * Surface-telemetry relay. Accepts a single event OR a batch of events
 * (the player buffers events for 5s with a PWA-backed offline retry —
 * see `components/learning/surface-telemetry-buffer.ts`). Best-effort:
 * always returns 204 so the client never reschedules on partial
 * upstream failures, but logs to observability so we can detect a
 * drop in the rate.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { getServerLearningClient } from "@/lib/bff/learning-svc";
import { SurfaceTelemetryRequest } from "@aivo/api-client/learning";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const BatchSchema = z.union([
  SurfaceTelemetryRequest,
  z.object({ events: z.array(SurfaceTelemetryRequest).min(1).max(50) }),
]);

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;

    const raw = await req.json().catch(() => ({}));
    const parsed = BatchSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid telemetry body",
        },
        requestId,
      );
    }

    const events = "events" in parsed.data ? parsed.data.events : [parsed.data];

    // Enforce per-event learner scope. Drop any event referencing a
    // learner the caller can't see rather than letting the upstream
    // service do the filtering — defense in depth.
    const allowed = events.filter((e) => {
      const scoped = requireLearnerScope(session!, e.learnerId, requestId);
      return scoped === null;
    });
    if (allowed.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const client = getServerLearningClient(req.headers.get("authorization"));
    await Promise.allSettled(allowed.map((evt) => client.surfaceTelemetry(evt)));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    logger.warn({ requestId, err: String(e) }, "surface-telemetry relay error");
    return failFromUnknown(e, requestId);
  }
}
