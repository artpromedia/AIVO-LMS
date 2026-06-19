/**
 * Sprint 5: POST /api/bff/learners/:learnerId/recommendations/:recId/respond
 *
 * Parent decision on a profile recommendation: accept | amend | decline.
 * Proxies the matching recommendation-svc decision endpoint after the same
 * session/role/scope/consent guards as sibling learner routes. The upstream
 * keeps its own parent-approval policy (actorRole) and durable effect
 * persistence (Sprint 4).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { respondToRecommendation } from "@/lib/bff/recommendation-svc";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; recId: string }> };

const bodySchema = z
  .object({
    action: z.enum(["accept", "amend", "decline", "add_context", "undo"]),
    amendedValue: z.unknown().optional(),
    declineReason: z.string().max(2000).optional(),
    context: z.string().max(2000).optional(),
  })
  .refine((b) => b.action !== "amend" || b.amendedValue !== undefined, {
    message: "amendedValue is required when action is amend",
  })
  .refine((b) => b.action !== "decline" || (b.declineReason ?? "").trim().length > 0, {
    message: "declineReason is required when action is decline",
  })
  .refine((b) => b.action !== "add_context" || (b.context ?? "").trim().length > 0, {
    message: "context is required when action is add_context",
  });

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, recId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }

    const result = await respondToRecommendation(
      { userId: session!.userId, tenantId: session!.tenantId },
      recId,
      parsed.data.action,
      {
        amendedValue: parsed.data.amendedValue,
        reason: parsed.data.declineReason,
        context: parsed.data.context,
        learnerId,
      },
    );
    if (!result.ok) {
      if (result.status === 404) {
        return fail({ ...ERRORS.NOT_FOUND, message: "Recommendation not found" }, requestId);
      }
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: `recommendation-svc respond failed: ${result.status} ${result.error}`,
          userMessage: "Couldn't record your decision — try again shortly.",
        },
        requestId,
      );
    }
    audit(session!, "recommendation.respond", requestId, {
      learnerId,
      metadata: {
        recommendationId: recId,
        action: parsed.data.action,
        outcome: result.recommendation.status,
      },
    });
    return ok({ recommendation: result.recommendation }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
