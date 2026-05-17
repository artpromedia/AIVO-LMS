import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { POST as generate } from "@/app/api/bff/learners/[learnerId]/context/generate/route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * POST /api/bff/learners/:learnerId/brain-profile/regenerate
 *
 * Alias for /context/generate — exposed as a parent-facing "regenerate"
 * action that resets the approval flag. Delegates to the generate route so
 * orchestration / validation stays in one place.
 */
export async function POST(req: Request, ctx: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const { learnerId } = await ctx.params;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = requireLearnerConsent(session!, learnerId, ["ai_personalization", "child_data_collection"], requestId);
    if (consentErr) return consentErr;
    // Delegate — generate already audits, validates and upserts (which resets
    // approvedByParent on regenerate).
    return await generate(req, ctx);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
