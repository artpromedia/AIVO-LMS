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
    const result = evaluateAll(body);
    if (result.recommendedAction !== "allow") {
      // Every non-allow decision is a safety event worth tracing.
      // Map RecommendedAction → audit event type; "block" is the only
      // hard-stop, the others document why the output was rewritten or
      // escalated for human review.
      const eventTypeMap: Record<
        string,
        "RESPONSIBLE_AI_BLOCKED" | "RESPONSIBLE_AI_REVISED" | "RESPONSIBLE_AI_ESCALATED"
      > = {
        block: "RESPONSIBLE_AI_BLOCKED",
        revise: "RESPONSIBLE_AI_REVISED",
        escalate: "RESPONSIBLE_AI_ESCALATED",
      };
      const eventType = eventTypeMap[result.recommendedAction];
      if (eventType) {
        await emitResponsibleAiAudit({
          request,
          eventType,
          learnerId: body.learnerId,
          contextType: body.contextType,
          severity: result.severity,
          violationCodes: result.violations.map((v) => v.code),
          details: {
            tutorSku: body.tutorSku,
            policyMode: body.policyMode,
            violationCount: result.violations.length,
          },
        });
      }
    }
    return result;
  });
}
