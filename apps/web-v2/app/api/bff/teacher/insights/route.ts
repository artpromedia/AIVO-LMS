/**
 * Sprint 11 — teacher insight authoring (web parity for the mobile
 * `(teacher)/student/[id]/insight.tsx` screen).
 *
 *   POST /api/bff/teacher/insights
 *     { learnerId, insightText, domain? }
 *
 * Auth: teacher role (parent allowed for ownership-scoped writes is OUT of
 * scope here — parents have their own surfaces).
 *
 * Dual-path (ADR 0009): when family-svc is enabled AND the caller has a
 * real identity-svc access token, the insight is POSTed to family-svc and
 * the dedicated `teacher_insights` row is returned. Otherwise the dev path
 * surfaces a clear "upstream disabled" error so callers don't see a fake
 * 201 (clinical-adjacent data must never silently succeed).
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import {
  isFamilySvcEnabled,
  getFamilyBearer,
  createTeacherInsight,
} from "@/lib/bff/family-svc";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["teacher"], requestId);
    if (roleErr) return roleErr;

    const body = (await req.json().catch(() => null)) as {
      learnerId?: unknown;
      insightText?: unknown;
      domain?: unknown;
    } | null;

    const learnerId = typeof body?.learnerId === "string" ? body.learnerId.trim() : "";
    const insightText =
      typeof body?.insightText === "string" ? body.insightText.trim() : "";
    if (!learnerId || !insightText) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: "learnerId and insightText are required",
        },
        requestId,
      );
    }
    const domain =
      typeof body?.domain === "string" && body.domain.trim() ? body.domain.trim() : undefined;

    const bearer = await getFamilyBearer();
    if (isFamilySvcEnabled() && bearer) {
      const r = await createTeacherInsight(bearer, { learnerId, insightText, domain });
      if (!r.ok) {
        return fail(
          {
            ...(r.status === 403 ? ERRORS.FORBIDDEN_LEARNER : ERRORS.UPSTREAM_UNAVAILABLE),
            message: r.error,
            status: r.status >= 500 ? 502 : r.status,
          },
          requestId,
        );
      }
      return ok(r.data, requestId, { status: 201 });
    }

    // Dev/mock path: refuse to fake a write. Teachers will get a clear
    // error rather than an optimistic "Saved" that loses the insight.
    return fail(
      {
        ...ERRORS.UPSTREAM_UNAVAILABLE,
        message:
          "family-svc not enabled or caller missing access token; teacher insights require a real backend",
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
