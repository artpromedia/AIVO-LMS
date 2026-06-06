import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { resolveEnterpriseFlags } from "@aivo/feature-flags";
import {
  getCalmCatalog,
  isCalmActivityId,
  getCalmActivity,
  affirmationKeyFor,
  recommendCalmActivity,
} from "@/lib/learner/calm";
import { recordCalmSession, getCalmStreak } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * GET — returns the universal Calm catalog (flag-independent) plus an
 * optional personalized recommendation when `selfRegulationHub` is on.
 * The recommendation is driven by `?action=` deep-linked from a focus
 * signal (e.g. the homework surface), keeping this surface stateless.
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const flags = resolveEnterpriseFlags(process.env as Record<string, string | undefined>);
    const action = new URL(req.url).searchParams.get("action");
    const recommended =
      flags.selfRegulationHub && action ? recommendCalmActivity(action) : null;

    // Streak is the learner's own encouragement — surfaced only to the
    // learner or the active-learner parent (the scope requireLearnerScope
    // already enforced), never to a teacher viewing the shared catalog.
    const tenantId = session!.tenantId;
    const streak =
      session!.role === "learner" || session!.role === "parent"
        ? getCalmStreak(learnerId, tenantId)
        : null;

    return ok({ catalog: getCalmCatalog(), recommended, streak }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/**
 * POST — record a completed (or abandoned) regulation moment. Body:
 *   { activityId: CalmActivityId, completed?: boolean, secondsSpent?: number }
 * No AI/consent dependency: regulation is always available to the learner.
 * We persist nothing new — usage rides the existing audit trail.
 */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["learner", "parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const limited = checkRateLimit(
      session!.userId,
      { routeKey: "calm.complete", ...RATE_LIMITS.WRITE_DEFAULT },
      requestId,
    );
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as {
      activityId?: unknown;
      completed?: unknown;
      secondsSpent?: unknown;
    };
    if (!isCalmActivityId(body.activityId)) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Unknown calm activity." },
        requestId,
      );
    }
    const completed = body.completed !== false; // default to true
    const secondsSpent =
      typeof body.secondsSpent === "number" && Number.isFinite(body.secondsSpent)
        ? Math.max(0, Math.min(3600, Math.round(body.secondsSpent)))
        : null;

    audit(session!, "calm.session.complete", requestId, {
      learnerId,
      metadata: { activityId: body.activityId, completed, secondsSpent },
    });

    // Persist a queryable record alongside the audit trail so the learner
    // can see a streak and the parent a calm regulation summary.
    recordCalmSession({
      tenantId: session!.tenantId,
      learnerId,
      activityId: body.activityId,
      activityKind: getCalmActivity(body.activityId).kind,
      completed,
      secondsSpent,
    });

    return ok({ affirmationKey: affirmationKeyFor(body.activityId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
