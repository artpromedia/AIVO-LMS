import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  ACTIVE_LEARNER_COOKIE,
  readActiveLearnerFromRequest,
  verifyActiveLearner,
} from "@/lib/auth/active-learner";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SetActiveBody = z
  .object({ learnerId: z.string().min(1).max(80) })
  .strict();

/** GET — return current active learner id (or null). */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const active = await readActiveLearnerFromRequest(req, session!);
    return ok({ activeLearnerId: active }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — set active learner (parent only; learner role is implicit-self). */
export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    if (session!.role !== "parent") {
      return fail(
        { ...ERRORS.FORBIDDEN_ROLE, message: "Only parents can set active learner" },
        requestId,
      );
    }
    const body = await req.json().catch(() => null);
    const parsed = SetActiveBody.safeParse(body);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "learnerId required" },
        requestId,
      );
    }
    const authorized = verifyActiveLearner(session!, parsed.data.learnerId);
    if (!authorized) {
      return fail(
        { ...ERRORS.FORBIDDEN_LEARNER, message: "Not your learner" },
        requestId,
      );
    }
    audit(session!, "active_learner.set", requestId, {
      learnerId: authorized,
    });
    const res = ok({ activeLearnerId: authorized }, requestId);
    // 30-day cookie; HttpOnly so JS can't read it; sameSite lax for nav-based flows.
    res.cookies.set({
      name: ACTIVE_LEARNER_COOKIE,
      value: authorized,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** DELETE — clear active learner. */
export async function DELETE(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const res = ok({ activeLearnerId: null }, requestId);
    res.cookies.set({
      name: ACTIVE_LEARNER_COOKIE,
      value: "",
      maxAge: 0,
      path: "/",
    });
    return res;
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
