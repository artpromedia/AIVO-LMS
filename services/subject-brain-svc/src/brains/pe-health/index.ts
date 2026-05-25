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
import { PE_HEALTH_ITEMS } from "./items.js";

/**
 * PE / Health brain (Sprint C.2 — completion plan).
 *
 * Drives `vigor` (`ADDON_TUTOR_PE_HEALTH`) across three tracks the
 * tutor's `authoringMeta.tracks` already advertises: fitness, health,
 * dape (Developmentally Adapted PE). The track is chosen by the
 * caller's `brainContext.dapeProfile` — DAPE swaps the locomotor
 * items for accessible mobility-skill items and drops the
 * manipulative ones unless the profile specifies upper-body strength.
 *
 * Physical-skill items can't be auto-graded inside the tutor. They
 * are demonstrated, then the caregiver / teacher confirms via a
 * checklist that arrives as `payload.checklist = { completed,
 * totalSteps }`. Procedural health items (hand-washing,
 * food-group sorts) grade on `correctness` or step-order.
 */
export class PeHealthBrain implements SubjectBrain {
  readonly subject = "pe_health" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("pe_health", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/throw|catch|kick|ball|locomotor|hop|skip|run/.test(lowerTopic)) {
      recommendedSurfaces.push("drag_manipulative", "voice_response");
    } else if (/food|nutrition|hygiene|wash/.test(lowerTopic)) {
      recommendedSurfaces.push("drag_manipulative", "choice_grid");
    } else {
      recommendedSurfaces.push("choice_grid");
    }

    const dapeProfile = (request.brainContext as { dapeProfile?: unknown }).dapeProfile;
    const recommendedScaffolds: string[] = dapeProfile
      ? [
          "DAPE track: substitute the locomotor pattern for an accessible mobility equivalent the learner can already perform.",
          "Confirm the goal in plain language — DAPE goals are individualized, not norm-referenced.",
          "Caregiver / aide is the rubric reporter; ask for one observation, not a score.",
        ]
      : [
          "Demonstrate the movement once, then ask the learner to attempt it.",
          "Caregiver or teacher confirms completion — physical skills aren't auto-scored.",
          "Health items: anchor to the learner's own routine (their soap, their snacks).",
        ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("SHAPE")
        ? "SHAPE"
        : code.startsWith("NHES")
          ? "NHES"
          : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "pe_health",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "pe_health",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const pool = PE_HEALTH_ITEMS.filter((i) => !seen.has(i.id));
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const payload = response.payload as
      | { checklist?: { completed?: number; totalSteps?: number } }
      | undefined;
    const checklist = payload?.checklist;
    if (checklist && checklist.totalSteps && checklist.totalSteps > 0) {
      const mastery = (checklist.completed ?? 0) / checklist.totalSteps;
      return {
        mastery,
        confidence: 0.6,
        feedback:
          mastery >= 0.9
            ? "Movement performed cleanly."
            : mastery >= 0.5
              ? "Good attempt — keep practicing."
              : "Demo the movement together once more.",
      };
    }
    const correctness = response.correctness ?? 0;
    return {
      mastery: correctness,
      confidence: 0.6,
      feedback: correctness >= 0.7 ? "Right." : "Let's revisit the steps.",
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg = recent.reduce((s, r) => s + (r.correctness ?? 0), 0) / recent.length;
    if (avg > 0.8) return { difficultyModulation: 1.1, rationale: "Step up — fluent." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "choice_grid",
        rationale: "Drop to comprehension; physical demo can come back next session.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold." };
  }
}
