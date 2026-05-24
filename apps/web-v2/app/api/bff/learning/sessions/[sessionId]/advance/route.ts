/**
 * BFF proxy for the v2 lesson player's "advance" call. Records a beat
 * transition + (optionally) a learner answer against the upstream
 * lesson session. Authoritative outcome derivation still happens on
 * `complete` — `advance` is for granular interaction telemetry.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getServerLearningClient } from "@/lib/bff/learning-svc";
import { LearningClientError } from "@aivo/api-client/learning";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  stepKind: z.string().min(1),
  stepRefId: z.string().nullable().optional(),
  response: z.string().optional(),
  isCorrect: z.boolean().optional(),
});

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { sessionId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid step body",
        },
        requestId,
      );
    }

    const client = getServerLearningClient(req.headers.get("authorization"));
    const out = await client.advanceSession(sessionId, parsed.data);
    return ok(out, requestId);
  } catch (e) {
    if (e instanceof LearningClientError) {
      return fail({ ...ERRORS.UPSTREAM_UNAVAILABLE, message: e.message }, requestId);
    }
    return failFromUnknown(e, requestId);
  }
}
