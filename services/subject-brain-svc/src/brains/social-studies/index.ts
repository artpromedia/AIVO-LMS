import { findSkillsByTopic, getPrerequisitesFor, getStandardsFor } from "../../services/skill-graph-store.js";
import { findMisconceptionsForTopic } from "../../services/misconception-store.js";
import { buildProfileAdaptations } from "../../services/profile-adaptations.js";
import type {
  AdaptDirective,
  Item,
  ItemResponse,
  LearnerState,
  ScoreResult,
  SkillGraphView,
  StandardReference,
  SubjectBrain,
  SubjectContextRequest,
  SubjectContextResponse,
} from "../../services/types.js";
import { SOCIAL_STUDIES_ITEMS } from "./items.js";

/**
 * Social-Studies brain.
 *
 * Skill graph: civics, geography, history, economics across K-8.
 * Surfaces mix text, video (with captions), and ChoiceGrid. Items live
 * in `items.ts` (30 fixtures); the production pipeline ramps via the
 * authoring cadence in Sprint 7.
 *
 * IRT-lite 3PL on item correctness — straightforward graded brain.
 */
export class SocialStudiesBrain implements SubjectBrain {
  readonly subject = "social_studies" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("social_studies", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/map|geograph|region|country|state/.test(lowerTopic)) {
      recommendedSurfaces.push("map_workspace", "choice_grid");
    }
    if (/history|past|war|revolution|civil/.test(lowerTopic)) {
      recommendedSurfaces.push("video", "timeline_workspace");
    }
    if (/economy|money|trade|market/.test(lowerTopic)) {
      recommendedSurfaces.push("scratchpad", "choice_grid");
    }
    if (recommendedSurfaces.length === 0) recommendedSurfaces.push("choice_grid");

    const recommendedScaffolds = [
      "Anchor each lesson to a primary source or a real artifact.",
      "Pair text with a map or timeline whenever possible.",
      "Pre-teach key vocabulary before the main passage.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("NCSS") ? "NCSS" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "social_studies",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: findMisconceptionsForTopic("social_studies", request.topic),
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "social_studies",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const pool = SOCIAL_STUDIES_ITEMS.filter((i) => !seen.has(i.id));
    if (pool.length === 0) return undefined;
    // 3PL nearest-theta pick.
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const correctness = response.correctness ?? 0;
    const confidence = correctness > 0.8 ? 0.8 : 0.5;
    return {
      mastery: correctness,
      confidence,
      feedback:
        correctness >= 0.8
          ? "Strong recall — you connected the source to the answer."
          : correctness >= 0.5
            ? "Close. Let's revisit the supporting evidence."
            : "Let's break the question into smaller parts.",
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg = recent.reduce((s, r) => s + (r.correctness ?? 0), 0) / recent.length;
    if (avg > 0.8) return { difficultyModulation: 1.15, rationale: "Step up." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "choice_grid",
        rationale: "Drop load; re-anchor with a visual.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold." };
  }
}
