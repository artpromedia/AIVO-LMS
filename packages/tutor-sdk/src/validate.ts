import type { TutorDefinition, TutorDefinitionIssue } from "./types.js";

const SEMVER_TAIL = /@\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.\-]+)?$/;

/**
 * Validate a `TutorDefinition` for missing fields, invalid id shape, and
 * obvious policy mistakes. Returns a flat list of issues; an empty list
 * means the definition is well-formed. The runtime should refuse to load
 * a tutor with any issues.
 */
export function validateTutorDefinition(def: TutorDefinition): TutorDefinitionIssue[] {
  const issues: TutorDefinitionIssue[] = [];

  if (def.schemaVersion !== 1) {
    issues.push({
      code: "unsupported_schema_version",
      detail: `Expected schemaVersion=1, got ${String(def.schemaVersion)}.`,
      path: "schemaVersion",
    });
  }

  if (!def.id || typeof def.id !== "string") {
    issues.push({ code: "missing_required_field", detail: "id is required.", path: "id" });
  } else if (!SEMVER_TAIL.test(def.id)) {
    issues.push({
      code: "invalid_id",
      detail: `id must end with @<semver>, got "${def.id}".`,
      path: "id",
    });
  }

  if (!def.persona || !def.persona.id || !def.persona.name) {
    issues.push({
      code: "missing_required_field",
      detail: "persona.id and persona.name are required.",
      path: "persona",
    });
  }

  if (!def.subjects || def.subjects.length === 0) {
    issues.push({ code: "empty_subjects", detail: "At least one subject is required.", path: "subjects" });
  }
  if (!def.gradeBands || def.gradeBands.length === 0) {
    issues.push({
      code: "empty_grade_bands",
      detail: "At least one grade band is required.",
      path: "gradeBands",
    });
  }
  if (!def.functioningLevels || def.functioningLevels.length === 0) {
    issues.push({
      code: "empty_functioning_levels",
      detail: "At least one functioning level is required.",
      path: "functioningLevels",
    });
  }
  if (!def.skillGraphRefs || def.skillGraphRefs.length === 0) {
    issues.push({
      code: "empty_skill_graph_refs",
      detail: "At least one skill-graph ref is required.",
      path: "skillGraphRefs",
    });
  }

  // Capabilities must be unique.
  if (def.capabilities) {
    const seen = new Set<string>();
    for (const c of def.capabilities) {
      if (seen.has(c)) {
        issues.push({
          code: "duplicate_capability",
          detail: `Capability "${c}" appears more than once.`,
          path: "capabilities",
        });
      }
      seen.add(c);
    }
    // Voice in/out implies consent must be required.
    const hasVoice = def.capabilities.includes("voice_in") || def.capabilities.includes("voice_out");
    if (hasVoice && def.policy && def.policy.requiresConsent === false) {
      issues.push({
        code: "policy_consent_required_for_voice",
        detail: "Tutors with voice_in/voice_out must require caregiver consent.",
        path: "policy.requiresConsent",
      });
    }
  }

  return issues;
}

/** Convenience — throws if validation fails. */
export function assertValidTutorDefinition(def: TutorDefinition): void {
  const issues = validateTutorDefinition(def);
  if (issues.length > 0) {
    const summary = issues.map((i) => `[${i.code}] ${i.detail}`).join("\n");
    throw new Error(`Invalid TutorDefinition:\n${summary}`);
  }
}
