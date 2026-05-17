import type { EvaluateInput, ViolationReport } from "./types.js";

export function evaluateSurfaceRequirements(input: EvaluateInput): ViolationReport[] {
  const violations: ViolationReport[] = [];
  const required = new Set(input.requiredSurfaces ?? []);
  if (required.size === 0) return violations;
  const output =
    typeof input.output === "object" && input.output !== null
      ? (input.output as { surfaces?: Array<{ type?: string }> })
      : null;
  const declaredSurfaces = new Set(
    (output?.surfaces ?? []).map((s) => s.type ?? "").filter(Boolean),
  );
  for (const requirement of required) {
    if (!declaredSurfaces.has(requirement)) {
      violations.push({
        code: `missing_required_surface_${requirement}`,
        message: `Output is missing required surface: ${requirement}.`,
      });
    }
  }
  return violations;
}

const RAW_HTML_PATTERN = /<\s*[a-z!][^>]*>/i;
const RAW_SVG_PATTERN = /<\s*svg\b/i;

export function detectRawMarkupInjection(input: EvaluateInput): ViolationReport[] {
  const text = typeof input.output === "string" ? input.output : JSON.stringify(input.output);
  const violations: ViolationReport[] = [];
  if (RAW_SVG_PATTERN.test(text) || RAW_HTML_PATTERN.test(text)) {
    violations.push({
      code: "raw_markup_injection",
      message: "Output contains raw HTML or SVG.",
    });
  }
  return violations;
}
