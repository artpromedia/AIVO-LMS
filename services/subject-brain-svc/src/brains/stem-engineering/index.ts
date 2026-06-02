import {
  findSkillsByTopic,
  getPrerequisitesFor,
  getStandardsFor,
} from "../../services/skill-graph-store.js";
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
import { STEM_ITEMS } from "./items.js";

/**
 * STEM-engineering brain (Sprint D — completion plan).
 *
 * Anchored on the NGSS engineering design process: define a problem,
 * sketch solutions, build and test, iterate. The brain is light on
 * pass/fail correctness because engineering is mostly procedural —
 * items grade on `payload.steps` (how many process steps the learner
 * completed) for procedural prompts and on correctness for discrete
 * comprehension checks (e.g. "which change is most likely to help?").
 *
 * Drives the `forge` tutor (`ADDON_TUTOR_STEM_DESIGN`).
 */
export class StemEngineeringBrain implements SubjectBrain {
  readonly subject = "stem_engineering" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("stem_engineering", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/sketch|design|ideate|brainstorm/.test(lowerTopic)) {
      recommendedSurfaces.push("art_canvas", "scratchpad");
    } else if (/build|test|prototype|iterate|improve/.test(lowerTopic)) {
      recommendedSurfaces.push("scratchpad", "choice_grid");
    } else {
      recommendedSurfaces.push("choice_grid", "scratchpad");
    }

    const recommendedScaffolds: string[] = [
      "Anchor every item to a real, tangible artifact (boat, tower, cup-phone).",
      "Make the failure visible — engineering progress comes from re-testing.",
      "Name the design step the learner is on so the process becomes the lesson.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("NGSS") ? "NGSS" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "stem_engineering",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "stem_engineering",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const pool = STEM_ITEMS.filter((i) => !seen.has(i.id));
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const payload = response.payload as
      | { stepsCompleted?: number; totalSteps?: number }
      | undefined;
    if (payload?.totalSteps && payload.totalSteps > 0) {
      const mastery = (payload.stepsCompleted ?? 0) / payload.totalSteps;
      return {
        mastery,
        confidence: 0.65,
        feedback:
          mastery >= 0.9
            ? "Full design loop — defined, sketched, tested, improved."
            : mastery >= 0.5
              ? "Good progress through the design steps."
              : "Try naming the step you're on before moving forward.",
      };
    }
    const correctness = response.correctness ?? 0;
    return {
      mastery: correctness,
      confidence: 0.6,
      feedback:
        correctness >= 0.7
          ? "Right — that's the change that helps."
          : "Look at what changed when it failed and try again.",
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg = recent.reduce((s, r) => s + (r.correctness ?? 0), 0) / recent.length;
    if (avg > 0.8) return { difficultyModulation: 1.1, rationale: "Step up — fluent design loop." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "choice_grid",
        rationale: "Drop to comprehension while we rebuild confidence.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold." };
  }
}
