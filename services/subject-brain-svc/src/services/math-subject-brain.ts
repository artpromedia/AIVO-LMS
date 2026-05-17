import { findSkillsByTopic, getPrerequisitesFor, getStandardsFor } from "./skill-graph-store.js";
import { findMisconceptionsForTopic } from "./misconception-store.js";
import { buildProfileAdaptations } from "./profile-adaptations.js";
import type {
  MasteryGap,
  StandardReference,
  SubjectBrain,
  SubjectContextRequest,
  SubjectContextResponse,
} from "./types.js";

function masteryGapFor(skillCode: string, mastery: number | undefined): MasteryGap | undefined {
  if (mastery === undefined) return undefined;
  if (mastery >= 0.8) return undefined;
  const severity: MasteryGap["severity"] =
    mastery < 0.3 ? "high" : mastery < 0.6 ? "medium" : "low";
  return { skillCode, mastery, severity };
}

export class MathSubjectBrain implements SubjectBrain {
  readonly subject = "math" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("math", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);
    const masteryLevels = request.brainContext.masteryLevels ?? {};
    const masteryGaps: MasteryGap[] = relevantSkills
      .map((code) => masteryGapFor(code, masteryLevels[code]))
      .filter((gap): gap is MasteryGap => gap !== undefined);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/geometry|area|perimeter|rectangle|triangle|circle|angle/.test(lowerTopic)) {
      recommendedSurfaces.push("geometry_workspace", "scratchpad");
    }
    if (/fraction|number line|halves|thirds|quarters/.test(lowerTopic)) {
      recommendedSurfaces.push("number_line", "drag_manipulative");
    }
    if (recommendedSurfaces.length === 0) {
      recommendedSurfaces.push("scratchpad");
    }

    const recommendedScaffolds: string[] = [
      "Model one similar step first.",
      "Use micro-hints before larger hints.",
      "Show units explicitly on the final answer.",
    ];

    const standardsList = getStandardsFor(relevantSkills);
    const standards: StandardReference[] = standardsList.map((code) => ({
      framework: code.startsWith("CCSS") ? "CCSS" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    const profileAdaptations = buildProfileAdaptations(
      "math",
      request.brainContext,
      request.functioningLevel,
    );

    return {
      subject: "math",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps,
      misconceptionRisks: findMisconceptionsForTopic("math", request.topic),
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations,
    };
  }
}
