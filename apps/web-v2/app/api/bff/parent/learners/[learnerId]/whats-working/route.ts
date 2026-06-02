import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { parentCanAccessLearner } from "@/lib/db/repos";
import {
  isFamilySvcEnabled,
  getFamilyBearer,
  getWhatsWorking,
  emptyWhatsWorking,
} from "@/lib/bff/family-svc";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** Clamp the requested window to the same 1–365 range family-svc enforces. */
function parseWindowDays(req: Request): number {
  const raw = new URL(req.url).searchParams.get("windowDays");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 365 ? Math.floor(n) : 30;
}

/**
 * Parent-facing "What's Working" analytics for one learner. Dual-path: real
 * family-svc when enabled + a real token; otherwise an empty insights payload
 * so the panel renders its empty state in dev/mock (there is no in-memory
 * ledger to analyse).
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    if (!(await parentCanAccessLearner(session!.userId, learnerId, session!.tenantId))) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Learner not found." }, requestId);
    }

    const windowDays = parseWindowDays(req);
    const bearer = await getFamilyBearer();
    if (isFamilySvcEnabled() && bearer) {
      const r = await getWhatsWorking(bearer, learnerId, windowDays);
      if (!r.ok) {
        return fail(
          {
            ...ERRORS.UPSTREAM_UNAVAILABLE,
            message: r.error,
            status: r.status >= 500 ? 502 : r.status,
          },
          requestId,
        );
      }
      return ok(r.data, requestId);
    }
    return ok(emptyWhatsWorking(windowDays), requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
