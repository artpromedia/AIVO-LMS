import { findSkillsByTopic, getStandardsFor } from "./skill-graph-store.js";
import { buildProfileAdaptations } from "./profile-adaptations.js";
import type {
  StandardReference,
  SubjectBrain,
  SubjectContextRequest,
  SubjectContextResponse,
} from "./types.js";

export class WorldLanguageSubjectBrain implements SubjectBrain {
  readonly subject = "world_language" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("world_language", request.topic);
    const relevantSkills = skills.map((s) => s.code);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = ["choice_grid"];
    if (/listen|audio/.test(lowerTopic)) recommendedSurfaces.push("voice_response");
    if (/speak|production/.test(lowerTopic)) recommendedSurfaces.push("voice_response");
    if (/read|annotation/.test(lowerTopic)) recommendedSurfaces.push("reading_annotation");

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("CEFR") ? "CEFR" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "world_language",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: [],
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds: [
        "Pair audio with text.",
        "Offer translation supports on demand.",
        "Provide cultural context notes.",
      ],
      standards,
      profileAdaptations: buildProfileAdaptations(
        "world_language",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }
}
