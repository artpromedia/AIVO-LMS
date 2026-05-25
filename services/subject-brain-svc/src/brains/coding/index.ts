import { findSkillsByTopic, getPrerequisitesFor, getStandardsFor } from "../../services/skill-graph-store.js";
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
import { CODING_ITEMS } from "./items.js";

/**
 * Coding brain (Sprint D — completion plan).
 *
 * Anchored on CSTA K-2 computational thinking: sequencing, loops,
 * conditionals, and debugging. Items are concrete and tangible
 * (robot moves, simple light/sound triggers) so learners who cannot
 * yet read a programming language can still demonstrate the
 * underlying CS concepts. The brain uses IRT-lite (3PL) on
 * correctness; debugging items can be partially correct (one of
 * multiple bugs found), in which case `payload.bugsFound /
 * totalBugs` becomes the rubric.
 */
export class CodingBrain implements SubjectBrain {
  readonly subject = "coding" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("coding", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/loop|repeat|again/.test(lowerTopic)) {
      recommendedSurfaces.push("drag_manipulative", "scratchpad");
    } else if (/if|condition|choice/.test(lowerTopic)) {
      recommendedSurfaces.push("choice_grid");
    } else if (/debug|bug|fix/.test(lowerTopic)) {
      recommendedSurfaces.push("scratchpad");
    } else {
      recommendedSurfaces.push("drag_manipulative", "choice_grid");
    }

    const recommendedScaffolds: string[] = [
      "Use a concrete agent (robot, sprite) — code without a body is abstract.",
      "Read the program out loud step by step before running it.",
      "Trace one input through the whole program before changing anything.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("CSTA") ? "CSTA" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "coding",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "coding",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const pool = CODING_ITEMS.filter((i) => !seen.has(i.id));
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const payload = response.payload as
      | { bugsFound?: number; totalBugs?: number }
      | undefined;
    if (payload?.totalBugs && payload.totalBugs > 0) {
      const mastery = (payload.bugsFound ?? 0) / payload.totalBugs;
      return {
        mastery,
        confidence: 0.7,
        feedback:
          mastery >= 0.9
            ? "All bugs found — program runs."
            : mastery >= 0.5
              ? "Most bugs caught. Run it once more."
              : "Trace the program line by line and look for the first odd step.",
      };
    }
    const correctness = response.correctness ?? 0;
    return {
      mastery: correctness,
      confidence: 0.65,
      feedback:
        correctness >= 0.7 ? "Nice — that program does what we asked." : "Let's read the program aloud and try again.",
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg = recent.reduce((s, r) => s + (r.correctness ?? 0), 0) / recent.length;
    if (avg > 0.8) return { difficultyModulation: 1.15, rationale: "Step up — fluent with basics." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "drag_manipulative",
        rationale: "Drop to manipulative — abstract syntax is getting in the way.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold." };
  }
}
