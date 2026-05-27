import { NextResponse } from "next/server";
import { requirePageRole } from "@/lib/auth/server";
import { parentCanAccessLearner, getBrainProfile } from "@/lib/db/repos";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { ACTIVE_LEARNER_COOKIE } from "@/lib/auth/active-learner";
import { createLearnerSessionCookie } from "@/lib/auth/learner-session";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;

  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    return NextResponse.redirect(new URL("/parent/learners", req.url));
  }

  const consentErr = requireLearnerConsent(
    session,
    learnerId,
    ["child_data_collection", "ai_personalization"],
    newRequestId(),
  );
  if (consentErr) {
    return NextResponse.redirect(
      new URL(`/parent/learners/${learnerId}?blocker=consent`, req.url),
    );
  }

  const profile = getBrainProfile(learnerId, session.tenantId);
  if (!profile || profile.cloneStage !== "approved") {
    return NextResponse.redirect(
      new URL(`/parent/learners/${learnerId}/brain-clone-watch`, req.url),
    );
  }

  audit(session, "parent.learner.handoff", newRequestId(), { learnerId });

  const res = NextResponse.redirect(new URL("/learner/home", req.url));
  res.headers.append(
    "Set-Cookie",
    createLearnerSessionCookie(session.userId, learnerId, session.tenantId),
  );
  res.cookies.set(ACTIVE_LEARNER_COOKIE, learnerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
