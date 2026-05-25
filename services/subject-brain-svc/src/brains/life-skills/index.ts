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
import { LIFE_ITEMS } from "./items.js";

/**
 * Life-Skills brain.
 *
 * Practical / functional content: self-care routines, safety, money,
 * household, community navigation. Uses IRT-lite (3PL) for the items
 * that have a correct answer (e.g. "which coin is a quarter?") and
 * non-graded checklists for procedural items (e.g. "show me how to
 * brush your teeth" — the checklist of steps becomes the rubric).
 */
export class LifeSkillsBrain implements SubjectBrain {
  readonly subject = "life_skills" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("life_skills", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const recommendedSurfaces = ["choice_grid", "scratchpad", "drag_manipulative"];
    const recommendedScaffolds = [
      "Anchor in a real scenario the learner has seen at home or in the community.",
      "Use photo cards where possible — text-only is harder for novel routines.",
      "Celebrate partial completion of multi-step routines.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: "LIFE",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "life_skills",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "life_skills",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const pool = LIFE_ITEMS.filter((i) => !seen.has(i.id));
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const stepsCompleted = Number(
      (response.payload as { stepsCompleted?: number } | undefined)?.stepsCompleted ?? 0,
    );
    const totalSteps = Number(
      (response.payload as { totalSteps?: number } | undefined)?.totalSteps ?? 0,
    );
    if (totalSteps > 0) {
      const mastery = stepsCompleted / totalSteps;
      return {
        mastery,
        confidence: 0.7,
        feedback:
          mastery >= 0.9
            ? "Full routine — independent."
            : mastery >= 0.5
              ? "Most of the steps. Nice work."
              : "Good start. We'll keep practicing the next steps.",
      };
    }
    const correctness = response.correctness ?? 0;
    return {
      mastery: correctness,
      confidence: 0.65,
      feedback: correctness >= 0.7 ? "You got it." : "Let's try one more example.",
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg = recent.reduce((s, r) => s + (r.correctness ?? 0), 0) / recent.length;
    if (avg > 0.8) return { difficultyModulation: 1.1, rationale: "Mastery trending up." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "choice_grid",
        rationale: "Routine too far; drop and re-anchor.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold." };
  }
}
