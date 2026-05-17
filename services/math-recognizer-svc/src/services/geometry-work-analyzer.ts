import { parseMathExpression } from "./expression-parser.js";
import type { RecognizedMisconception } from "./provider-interface.js";

export interface GeometryAnalysisInput {
  prompt?: string;
  skillCode?: string;
  finalAnswer?: string | number;
  typedWork?: string;
  geometryContext?: Record<string, unknown>;
}

export interface GeometryAnalysisResult {
  misconceptions: RecognizedMisconception[];
  expectedFormula?: "area_rectangle" | "perimeter_rectangle";
}

function detectPromptIntent(
  prompt: string | undefined,
): "area" | "perimeter" | "radius" | "diameter" | "circumference" | undefined {
  if (!prompt) return undefined;
  const lower = prompt.toLowerCase();
  if (/\barea\b/.test(lower)) return "area";
  if (/\bperimeter\b/.test(lower)) return "perimeter";
  if (/\bcircumference\b/.test(lower)) return "circumference";
  if (/\bdiameter\b/.test(lower)) return "diameter";
  if (/\bradius\b/.test(lower)) return "radius";
  return undefined;
}

export function analyzeGeometryWork(input: GeometryAnalysisInput): GeometryAnalysisResult {
  const misconceptions: RecognizedMisconception[] = [];
  const intent = detectPromptIntent(input.prompt);
  const work = parseMathExpression(input.typedWork);

  if (intent === "area" && work.detectedFormula === "perimeter_rectangle") {
    misconceptions.push({
      id: "perimeter_instead_of_area",
      label: "Used perimeter formula instead of area",
      evidence: "Work shows 2*(l+w) but the prompt asks for area.",
    });
  }
  if (intent === "perimeter" && work.detectedFormula === "area_rectangle") {
    misconceptions.push({
      id: "area_instead_of_perimeter",
      label: "Used area formula instead of perimeter",
      evidence: "Work shows l*w but the prompt asks for perimeter.",
    });
  }
  if (intent === "area" && input.finalAnswer !== undefined && !work.hasUnit) {
    misconceptions.push({
      id: "missing_unit",
      label: "Missing unit on the final answer",
      evidence: "Area answers require a squared unit.",
    });
  }
  if (
    (intent === "radius" || intent === "diameter") &&
    /(radius|diameter)/i.test(input.typedWork ?? "")
  ) {
    const work = (input.typedWork ?? "").toLowerCase();
    if (intent === "radius" && /diameter/.test(work) && !/radius/.test(work)) {
      misconceptions.push({
        id: "diameter_for_radius",
        label: "Used diameter where radius was requested",
        evidence: "Work mentions diameter but the prompt asks for radius.",
      });
    }
    if (intent === "diameter" && /radius/.test(work) && !/diameter/.test(work)) {
      misconceptions.push({
        id: "radius_for_diameter",
        label: "Used radius where diameter was requested",
        evidence: "Work mentions radius but the prompt asks for diameter.",
      });
    }
  }
  return {
    misconceptions,
    expectedFormula:
      intent === "area"
        ? "area_rectangle"
        : intent === "perimeter"
          ? "perimeter_rectangle"
          : undefined,
  };
}
