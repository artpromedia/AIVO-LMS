import type { EvaluateInput, ViolationReport } from "./types.js";

export function evaluateProfileAdherence(input: EvaluateInput): ViolationReport[] {
  const violations: ViolationReport[] = [];
  const profile = input.learnerProfileSummary ?? {};
  const textOutput = typeof input.output === "string" ? input.output : JSON.stringify(input.output);

  if (
    profile.functioningLevel === "NON_VERBAL" &&
    profile.speechAvailable !== true &&
    /\b(say|speak|tell me out loud|verbalize)\b/i.test(textOutput)
  ) {
    violations.push({
      code: "speech_required_for_non_verbal",
      message: "Tutor asked a NON_VERBAL learner to speak.",
    });
  }

  if (
    (profile.functioningLevel === "LOW_VERBAL" || profile.functioningLevel === "PRE_SYMBOLIC") &&
    textOutput.length > 600
  ) {
    violations.push({
      code: "long_text_for_low_verbal",
      message: "Output is too long for a LOW_VERBAL / PRE_SYMBOLIC learner.",
    });
  }

  const declared = new Set((profile.declaredFactsInBrain ?? []).map((f) => f.toLowerCase()));
  const claimedFactMatches =
    textOutput.match(/(?:we know|your file says|brain shows)\s+([^\.]+)/gi) ?? [];
  for (const match of claimedFactMatches) {
    const claim = match.replace(/(?:we know|your file says|brain shows)\s+/i, "").trim();
    if (claim && !Array.from(declared).some((f) => claim.toLowerCase().includes(f))) {
      violations.push({
        code: "hallucinated_profile_fact",
        message: "Output claims a profile fact not present in Brain context.",
        evidence: claim.slice(0, 100),
      });
      break;
    }
  }

  return violations;
}
