import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { getLessonSyncState, putLessonSyncState } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lessonRunId: string }> };

const postSchema = z.object({
  learnerId: z.string().min(1),
  baseVersion: z.number().int().min(0),
  state: z.record(z.string(), z.unknown()),
  deviceId: z.string().min(1).max(128),
});

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { lessonRunId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const state = getLessonSyncState(lessonRunId, session!.tenantId);
    if (!state) {
      // Empty initial state — return version 0 so callers can POST baseVersion=0
      // to create the row on the next write. No learner data is leaked here.
      return ok({ state: null, version: 0 }, requestId);
    }
    // Enforce learner scoping on read regardless of role: a parent for
    // learner A must not be able to read learner B's run even within the
    // same tenant. requireLearnerScope() handles role-aware checks.
    const scopeErr = await requireLearnerScope(session!, state.learnerId, requestId);
    if (scopeErr) return scopeErr;
    return ok({ state, version: state.version }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { lessonRunId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const scopeErr = await requireLearnerScope(session!, parsed.data.learnerId, requestId);
    if (scopeErr) return scopeErr;
    const result = putLessonSyncState({
      lessonRunId,
      tenantId: session!.tenantId,
      learnerId: parsed.data.learnerId,
      baseVersion: parsed.data.baseVersion,
      state: parsed.data.state,
      deviceId: parsed.data.deviceId,
    });
    if (!result.ok) {
      // Conflict — caller's baseVersion doesn't match current. Surface the
      // current state so the player can merge or prompt the learner. We
      // intentionally include `current` in the error envelope's metadata
      // via the JSON body alongside the normalized error code.
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ERRORS.PRECONDITION_FAILED.code,
            message: "Sync conflict — another device wrote first.",
            userMessage: ERRORS.PRECONDITION_FAILED.userMessage,
            retryable: false,
          },
          current: result.current,
          currentVersion: result.current?.version ?? null,
          requestId,
        },
        { status: 409 },
      );
    }
    return ok({ state: result.state, version: result.state.version }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
