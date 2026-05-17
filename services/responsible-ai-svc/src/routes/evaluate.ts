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
    return evaluateAll(body);
  });
}
