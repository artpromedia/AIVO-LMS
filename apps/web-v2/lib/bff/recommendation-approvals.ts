/**
 * Wave C (G5) — shared handlers for the teacher/caregiver recommendation
 * approval surfaces.
 *
 * Same guard chain as the parent routes (session → role at the route →
 * learner scope → learner consents), then recommendation-svc enforces the
 * role × type × tenant-policy matrix and 403s any decision the district
 * has not delegated — that denial is surfaced as FORBIDDEN_ROLE with
 * an explanation, never disguised as an upstream outage.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import type { SessionProfile } from "@/lib/auth/types";
import {
  listRecommendationsForLearner,
  respondToRecommendation,
  type RecommendationActorRole,
} from "@/lib/bff/recommendation-svc";

const respondBodySchema = z
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

export async function handleListRecommendations(
  _req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
): Promise<NextResponse> {
  const scope = await requireLearnerScope(session, learnerId, requestId);
  if (scope) return scope;
  const consentErr = await requireLearnerConsent(
    session,
    learnerId,
    ["child_data_collection", "ai_personalization"],
    requestId,
  );
  if (consentErr) return consentErr;
  try {
    const result = await listRecommendationsForLearner(
      { userId: session.userId, tenantId: session.tenantId },
      learnerId,
    );
    return ok(result, requestId);
  } catch (e) {
    if (e instanceof Error && /recommendation-svc list failed/.test(e.message)) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: e.message,
          userMessage: "Recommendations are unavailable right now — try again shortly.",
        },
        requestId,
      );
    }
    return failFromUnknown(e, requestId);
  }
}

export async function handleRespondToRecommendation(
  req: Request,
  requestId: string,
  session: SessionProfile,
  learnerId: string,
  recId: string,
  actorRole: RecommendationActorRole,
): Promise<NextResponse> {
  const scope = await requireLearnerScope(session, learnerId, requestId);
  if (scope) return scope;
  const consentErr = await requireLearnerConsent(
    session,
    learnerId,
    ["child_data_collection", "ai_personalization"],
    requestId,
  );
  if (consentErr) return consentErr;

  const json = await req.json().catch(() => ({}));
  const parsed = respondBodySchema.safeParse(json);
  if (!parsed.success) {
    return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
  }
  try {
    const result = await respondToRecommendation(
      { userId: session.userId, tenantId: session.tenantId },
      recId,
      parsed.data.action,
      {
        amendedValue: parsed.data.amendedValue,
        reason: parsed.data.declineReason,
        context: parsed.data.context,
        actorRole,
        learnerId,
      },
    );
    if (!result.ok) {
      if (result.status === 404) {
        return fail({ ...ERRORS.NOT_FOUND, message: "Recommendation not found" }, requestId);
      }
      if (result.status === 403) {
        return fail(
          {
            ...ERRORS.FORBIDDEN_ROLE,
            message: `recommendation-svc denied ${actorRole} decision: ${result.error}`,
            userMessage:
              "This decision needs the parent (or a role your district has delegated) to approve.",
          },
          requestId,
        );
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
    audit(session, "recommendation.respond", requestId, {
      learnerId,
      metadata: {
        recommendationId: recId,
        action: parsed.data.action,
        actorRole,
        outcome: result.recommendation.status,
      },
    });
    return ok({ recommendation: result.recommendation }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
