import type { FastifyInstance } from "fastify";
import type { EvaluateInput, EvaluateOutput, ViolationReport } from "../services/types.js";
import { detectPromptInjection } from "../services/prompt-injection-detector.js";
import { evaluateProfileAdherence } from "../services/profile-adherence-evaluator.js";
import { evaluateHomeworkIntegrity } from "../services/homework-integrity-evaluator.js";
import { evaluateAgeAppropriateness } from "../services/age-appropriateness-evaluator.js";
import {
  detectRawMarkupInjection,
  evaluateSurfaceRequirements,
} from "../services/surface-requirement-evaluator.js";
import { decideEvaluateOutput } from "../services/escalation-policy.js";
import { emitResponsibleAiAudit } from "../lib/audit.js";
import { runPipeline } from "../pipeline.js";
import {
  escalateCrisis,
  type CrisisEscalationContext,
} from "../detectors/crisis.js";
import type { CrisisCategory } from "../detectors/types.js";
import { recordCrisisEscalation } from "../metrics.js";

/**
 * Sprint 14: legacy evaluator that ran a fan-out of TS evaluator helpers
 * directly. Retained so existing callers keep getting the same EvaluateOutput
 * envelope, but every call also runs the new four-detector pipeline and the
 * stronger verdict wins. The pipeline is the authoritative safety check; the
 * legacy helpers add domain-specific signals (surface requirements, homework
 * integrity, profile adherence) we don't want to lose.
 */
export function evaluateAll(input: EvaluateInput): EvaluateOutput {
  const text = typeof input.output === "string" ? input.output : JSON.stringify(input.output);
  const violations: ViolationReport[] = [
    ...detectPromptInjection(text),
    ...detectPromptInjection(input.inputSummary ?? ""),
    ...evaluateProfileAdherence(input),
    ...evaluateHomeworkIntegrity(input),
    ...evaluateAgeAppropriateness(input),
    ...evaluateSurfaceRequirements(input),
    ...detectRawMarkupInjection(input),
  ];
  return decideEvaluateOutput(violations, input.policyMode);
}

export function registerEvaluateRoutes(app: FastifyInstance): void {
  app.post<{ Body: EvaluateInput }>("/api/responsible-ai/evaluate", async (request, reply) => {
    const body = request.body;
    if (
      !body ||
      !body.learnerId ||
      !body.contextType ||
      !body.policyMode ||
      body.output === undefined
    ) {
      return reply
        .code(400)
        .send({ error: "learnerId, contextType, policyMode, and output are required" });
    }

    const text =
      typeof body.output === "string" ? body.output : JSON.stringify(body.output);
    const composedText = `${body.inputSummary ?? ""}\n\n${text}`;
    const auth = (request as unknown as { auth?: { tenantId?: string } }).auth ?? {};

    let pipelineResult;
    try {
      pipelineResult = await runPipeline({
        text: composedText,
        learnerId: body.learnerId,
        tenantId: auth.tenantId,
        contextType: body.contextType,
        correlationId:
          (request as unknown as { requestId?: string }).requestId ??
          (request.headers["x-request-id"] as string | undefined) ??
          undefined,
      });
    } catch (err) {
      // Pipeline itself threw — fail CLOSED at the route level too.
      request.log.error(
        { err: (err as Error).message },
        "responsible-ai pipeline crashed; failing closed",
      );
      return reply.code(503).send({
        error: "responsible-ai pipeline unavailable; failing closed",
      });
    }

    // Legacy fan-out evaluator (kept for surface/profile/homework signals).
    const legacy = evaluateAll(body);

    // Pipeline verdict wins when stronger than the legacy decision.
    const stronger = combine(legacy.recommendedAction, pipelineResult.verdict);
    const finalAllowed = stronger.recommendedAction === "allow";

    const merged: EvaluateOutput = {
      allowed: finalAllowed,
      severity:
        stronger.recommendedAction === "allow"
          ? legacy.severity
          : pipelineResult.verdict === "block"
            ? "critical"
            : pipelineResult.verdict === "review"
              ? "high"
              : legacy.severity,
      violations: [
        ...legacy.violations,
        ...pipelineResult.detectors.flatMap((d) =>
          d.evidence.map((e) => ({
            code: e.code,
            message: e.message,
            evidence: e.evidence,
          })),
        ),
      ],
      recommendedAction: stronger.recommendedAction,
    };

    // Audit emission and crisis-escalation side-effects.
    if (merged.recommendedAction !== "allow") {
      const eventTypeMap: Record<
        string,
        "RESPONSIBLE_AI_BLOCKED" | "RESPONSIBLE_AI_REVISED" | "RESPONSIBLE_AI_ESCALATED"
      > = {
        block: "RESPONSIBLE_AI_BLOCKED",
        revise: "RESPONSIBLE_AI_REVISED",
        escalate: "RESPONSIBLE_AI_ESCALATED",
      };
      const eventType = eventTypeMap[merged.recommendedAction];
      if (eventType) {
        await emitResponsibleAiAudit({
          request,
          eventType,
          learnerId: body.learnerId,
          contextType: body.contextType,
          severity: merged.severity,
          violationCodes: merged.violations.map((v) => v.code),
          details: {
            tutorSku: body.tutorSku,
            policyMode: body.policyMode,
            violationCount: merged.violations.length,
            pipelineFailedClosed: pipelineResult.failedClosed,
          },
        });
      }
      // Crisis branch: fire-and-forget escalation if crisis detector flagged.
      const crisis = pipelineResult.detectors.find(
        (d) => d.detector === "crisis" && d.verdict === "block",
      );
      if (crisis && crisis.meta && (crisis.meta as { category?: string }).category) {
        const ctx: CrisisEscalationContext = {
          correlationId:
            (request as unknown as { requestId?: string }).requestId ??
            `crisis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          learnerId: body.learnerId,
          tenantId: auth.tenantId,
          category: (crisis.meta as { category: CrisisCategory }).category,
          detectedAt: new Date().toISOString(),
        };
        recordCrisisEscalation(ctx.tenantId ?? "unknown");
        // Don't block the reply on the escalation fan-out.
        void escalateCrisis(ctx).catch((err) => {
          request.log.warn(
            { err: (err as Error).message, learnerId: body.learnerId },
            "crisis escalation fan-out failed",
          );
        });
      }
    }

    return merged;
  });
}

/**
 * Combine the legacy `RecommendedAction` with the pipeline verdict so the
 * stronger decision wins.
 *
 *   pipeline 'block'   ⇒ recommendedAction 'block'
 *   pipeline 'review'  ⇒ at least 'revise'
 *   pipeline 'allow'   ⇒ legacy decision unchanged
 */
function combine(
  legacyAction: EvaluateOutput["recommendedAction"],
  pipelineVerdict: "allow" | "block" | "review",
): { recommendedAction: EvaluateOutput["recommendedAction"] } {
  if (pipelineVerdict === "block") return { recommendedAction: "block" };
  if (pipelineVerdict === "review") {
    if (legacyAction === "block" || legacyAction === "escalate")
      return { recommendedAction: legacyAction };
    return { recommendedAction: "revise" };
  }
  return { recommendedAction: legacyAction };
}
