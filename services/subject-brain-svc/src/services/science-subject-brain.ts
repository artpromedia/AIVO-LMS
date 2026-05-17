import { findSkillsByTopic, getPrerequisitesFor, getStandardsFor } from "./skill-graph-store.js";
import { findMisconceptionsForTopic } from "./misconception-store.js";
import { buildProfileAdaptations } from "./profile-adaptations.js";
import type {
  StandardReference,
  SubjectBrain,
  SubjectContextRequest,
  SubjectContextResponse,
} from "./types.js";

export class ScienceSubjectBrain implements SubjectBrain {
  readonly subject = "science" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("science", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/classif|sort|group/.test(lowerTopic)) {
      recommendedSurfaces.push("drag_manipulative", "choice_grid");
    }
    if (/water cycle|cycle|sequence|order/.test(lowerTopic)) {
      recommendedSurfaces.push("science_diagram", "drag_manipulative");
    }
    if (/observ|inference|evidence/.test(lowerTopic)) {
      recommendedSurfaces.push("reading_annotation", "science_diagram");
    }
    if (recommendedSurfaces.length === 0) {
      recommendedSurfaces.push("science_diagram");
    }

    const recommendedScaffolds = [
      "Separate observation from inference with two columns.",
      "Use diagrams to anchor cause-effect chains.",
      "Pre-teach vocabulary the activity uses.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("NGSS") ? "NGSS" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "science",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: findMisconceptionsForTopic("science", request.topic),
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "science",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }
}
