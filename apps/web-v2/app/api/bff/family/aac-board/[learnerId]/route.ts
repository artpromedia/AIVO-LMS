/**
 * BFF wrapper around family-svc's `/api/family/aac-board/:learnerId`, which
 * itself proxies brain-svc's `GET /api/brain/aac-board/{learner_id}` (PR #57).
 *
 * The brain service returns a real board derived from IEP goals + curriculum,
 * with a default 30-symbol fallback. We add the standard session + role gate
 * and forward the response shape unchanged.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok, fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";

export const dynamic = "force-dynamic";

const FAMILY_SVC_URL = process.env.FAMILY_SVC_URL ?? "http://localhost:3010";

/**
 * Minimal fallback board so the learner-facing UI always has something to
 * render, even if family-svc / brain-svc are unreachable. Matches the
 * SymbolBoard shape in @aivo/aac-bridge.
 */
const FALLBACK_BOARD = {
  id: "fallback-30",
  name: "Default Board",
  locale: "en-US",
  grid: { rows: 5, cols: 6 },
  items: [
    "yes",
    "no",
    "please",
    "thank you",
    "more",
    "stop",
    "help",
    "I",
    "you",
    "want",
    "like",
    "go",
    "play",
    "eat",
    "drink",
    "happy",
    "sad",
    "tired",
    "hot",
    "cold",
    "home",
    "school",
    "friend",
    "book",
    "music",
    "outside",
    "bathroom",
    "again",
    "all done",
    "wait",
  ].map((label, i) => ({
    id: `fallback-${i}`,
    label,
    imageUrl: `/aac/symbols/${encodeURIComponent(label)}.svg`,
    boardId: "fallback-30",
    position: { row: Math.floor(i / 6), col: i % 6 },
  })),
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ learnerId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher", "therapist"], requestId);
    if (roleErr) return roleErr;

    const { learnerId } = await ctx.params;
    if (!learnerId || learnerId.length > 64) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "Invalid learnerId." }, requestId);
    }

    try {
      const upstream = await fetch(
        `${FAMILY_SVC_URL}/api/family/aac-board/${encodeURIComponent(learnerId)}`,
        {
          headers: {
            "X-Request-Id": requestId,
            "X-Tenant-Id": session!.tenantId,
            "X-User-Id": session!.userId,
          },
          // Family-svc should respond quickly; brain-svc may take longer
          // when synthesizing from IEP goals.
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (upstream.ok) {
        const board = await upstream.json();
        return ok({ board }, requestId);
      }
    } catch {
      // Fall through to the fallback board.
    }
    return ok({ board: FALLBACK_BOARD, fallback: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
