import { randomUUID } from "node:crypto";
import { detectArithmeticMismatch, parseMathExpression } from "./expression-parser.js";
import { analyzeGeometryWork } from "./geometry-work-analyzer.js";
import { extractStrokeFeatures } from "./stroke-feature-extractor.js";
import type {
  MathRecognizerProvider,
  RecognizeInput,
  RecognizeOutput,
  RecognizedStep,
} from "./provider-interface.js";

export class RuleBasedMathRecognizer implements MathRecognizerProvider {
  async recognize(input: RecognizeInput): Promise<RecognizeOutput> {
    const work = parseMathExpression(input.typedWork);
    const features = extractStrokeFeatures(input.strokes);
    const steps: RecognizedStep[] = [];
    const misconceptions = analyzeGeometryWork({
      prompt: input.prompt,
      skillCode: input.skillCode,
      finalAnswer: input.finalAnswer,
      typedWork: input.typedWork,
      geometryContext: input.geometryContext,
    }).misconceptions;

    if (input.typedWork) {
      steps.push({
        id: randomUUID(),
        type: work.detectedFormula ? "formula" : "calculation",
        value: work.normalized,
        confidence: 0.7,
      });
    }
    if (input.finalAnswer !== undefined) {
      steps.push({
        id: randomUUID(),
        type: "answer",
        value: String(input.finalAnswer),
        confidence: 0.9,
      });
    }

    if (features.isBlank && input.finalAnswer !== undefined && !input.typedWork) {
      misconceptions.push({
        id: "blank_scratchpad_with_answer",
        label: "Final answer submitted with no shown work",
        evidence: "Scratchpad is empty but a final answer was submitted.",
      });
    }

    if (detectArithmeticMismatch(input.typedWork, input.finalAnswer)) {
      misconceptions.push({
        id: "arithmetic_mismatch",
        label: "Final answer does not match the shown work",
        evidence: "The arithmetic of the shown work does not produce the final answer.",
      });
    }

    let correctness: boolean | undefined;
    if (input.expectedAnswer !== undefined && input.finalAnswer !== undefined) {
      const expected = Number(input.expectedAnswer);
      const actual = Number(input.finalAnswer);
      if (Number.isFinite(expected) && Number.isFinite(actual)) {
        correctness = Math.abs(expected - actual) < 1e-6;
      } else {
        correctness = String(input.expectedAnswer).trim() === String(input.finalAnswer).trim();
      }
    }

    const feedbackHint = misconceptions[0]?.label
      ? `Consider: ${misconceptions[0].label.toLowerCase()}.`
      : undefined;

    return {
      recognizedExpression: input.typedWork ? work.normalized : undefined,
      recognizedSteps: steps,
      misconceptions,
      feedbackHint,
      correctness,
      confidence: input.typedWork ? 0.6 : 0.4,
    };
  }
}
