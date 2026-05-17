import { findSkillsByTopic, getPrerequisitesFor, getStandardsFor } from "./skill-graph-store.js";
import { findMisconceptionsForTopic } from "./misconception-store.js";
import { buildProfileAdaptations } from "./profile-adaptations.js";
import type {
  StandardReference,
  SubjectBrain,
  SubjectContextRequest,
  SubjectContextResponse,
} from "./types.js";

export class ElaSubjectBrain implements SubjectBrain {
  readonly subject = "ela" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("ela", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/read|comprehension|annotation/.test(lowerTopic)) {
      recommendedSurfaces.push("reading_annotation");
    }
    if (/vocab/.test(lowerTopic)) {
      recommendedSurfaces.push("choice_grid");
    }
    if (/writ|compos/.test(lowerTopic)) {
      recommendedSurfaces.push("scratchpad", "multi_step_workspace");
    }
    if (recommendedSurfaces.length === 0) {
      recommendedSurfaces.push("reading_annotation");
    }

    const recommendedScaffolds = [
      "Chunk passages into short sections.",
      "Preview vocabulary with images and definitions.",
      "Use sentence frames for written response.",
    ];

    if (request.functioningLevel === "LOW_VERBAL" || request.functioningLevel === "PRE_SYMBOLIC") {
      recommendedScaffolds.unshift("Reduce text density and offer audio playback.");
    }

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("CCSS") ? "CCSS" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "ela",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: findMisconceptionsForTopic("ela", request.topic),
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "ela",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }
}
