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
import { SEL_ITEMS } from "./items.js";

/**
 * Social-Emotional Learning (SEL) brain.
 *
 * Implements the four classroom-facing CASEL competencies (self-awareness,
 * self-management, social-awareness, relationship-skills) plus responsible
 * decision-making.
 *
 * Key distinction from graded brains: SEL never produces a pass/fail
 * score. Item responses are mapped to non-judgmental mastery bands:
 *   - "emerging"    — first encounter, just starting to identify
 *   - "developing"  — recognizes the concept, needs support
 *   - "consistent"  — applies it without prompting
 *   - "reflective"  — can teach / model it to peers
 *
 * Adaptation is qualitative: surface modulation (e.g. drop to choice-grid
 * if voice-response was skipped) instead of difficulty modulation.
 */
export class SocialEmotionalBrain implements SubjectBrain {
  readonly subject = "social_emotional" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("social_emotional", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const recommendedSurfaces = ["choice_grid", "voice_response", "scratchpad"];
    const recommendedScaffolds = [
      "Lead with a feeling-word bank and visual emotion chart.",
      "Reassure: there is no wrong answer — reflection is the goal.",
      "Offer a sentence frame for verbal response.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: "CASEL",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "social_emotional",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "social_emotional",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    // Prefer the lowest-mastery competency to cycle exposure across CASEL.
    const weakest = Object.entries(state.masteryLevels)
      .filter(([code]) => code.startsWith("SEL."))
      .sort(([, a], [, b]) => a - b)[0]?.[0];
    const candidates = SEL_ITEMS.filter(
      (it) => !seen.has(it.id) && (!weakest || it.skillCode === weakest),
    );
    const pool = candidates.length > 0 ? candidates : SEL_ITEMS.filter((it) => !seen.has(it.id));
    return pool[0];
  }

  score(response: ItemResponse): ScoreResult {
    // Non-judgmental scoring: presence-and-depth of reflection, not correctness.
    const reflectionDepth = Number(
      (response.payload as { reflectionDepth?: number } | undefined)?.reflectionDepth ?? 0,
    );
    const submitted = response.payload && Object.keys(response.payload).length > 0;
    let band: ScoreResult["band"] = "emerging";
    let mastery = 0.25;
    if (submitted && reflectionDepth >= 3) {
      band = "reflective";
      mastery = 0.9;
    } else if (submitted && reflectionDepth >= 2) {
      band = "consistent";
      mastery = 0.7;
    } else if (submitted && reflectionDepth >= 1) {
      band = "developing";
      mastery = 0.5;
    }
    return {
      mastery,
      confidence: submitted ? 0.6 : 0.3,
      feedback:
        band === "emerging"
          ? "Thanks for showing up. Naming feelings takes practice."
          : band === "developing"
            ? "Nice reflection. Notice what your body felt, too."
            : band === "consistent"
              ? "You named the feeling and the strategy. That's growth."
              : "You went deep — and could help a friend think through this.",
      band,
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const skipped = history.filter((h) => !h.payload || Object.keys(h.payload).length === 0).length;
    const skipRate = history.length > 0 ? skipped / history.length : 0;
    if (skipRate > 0.5) {
      return {
        difficultyModulation: 1.0,
        recommendedSurface: "choice_grid",
        rationale: "High skip rate on open response — drop to lower-stakes choice surface.",
      };
    }
    return {
      difficultyModulation: 1.0,
      rationale: "SEL does not modulate difficulty; pacing held steady.",
    };
  }
}
