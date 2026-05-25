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
import { CREATIVE_ARTS_ITEMS } from "./items.js";

/**
 * Creative-arts brain (Sprint D — completion plan).
 *
 * Covers both **visual** arts (NCAS) and **creative writing** (CCSS.W
 * narrative strand). Two strands intentionally live under one brain
 * because the tutor catalog has two personas that map here:
 *   - `cadence` / `ADDON_TUTOR_ARTS` (visual)
 *   - `muse` / `ADDON_TUTOR_CREATIVE_WRITING` (writing)
 *
 * Open-ended creative work doesn't map cleanly to pass/fail. Items
 * that produce art or text are scored by **rubric** signals on the
 * payload (`payload.rubric.usesTargetElement`, etc.) and emit a
 * qualitative band rather than a correctness score. Discrete items
 * (e.g. color mixing) still use IRT-lite on correctness.
 */
export class CreativeArtsBrain implements SubjectBrain {
  readonly subject = "creative_arts" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("creative_arts", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const isWriting = /write|story|describe|poem|sentence/.test(lowerTopic);
    const recommendedSurfaces: string[] = isWriting
      ? ["scratchpad", "voice_response"]
      : ["art_canvas", "choice_grid"];

    const recommendedScaffolds: string[] = isWriting
      ? [
          "Show one example with the structure highlighted before the open prompt.",
          "Allow voice input — handwriting/typing friction can mask creative thinking.",
          "Celebrate any output that meets the prompt; revise later.",
        ]
      : [
          "Show 2-3 contrasting exemplars before the canvas opens.",
          "Name the element being practiced (line / color / shape) as the learner works.",
          "Let the learner narrate the work — process matters more than product.",
        ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("CCSS") ? "CCSS" : code.startsWith("NCAS") ? "NCAS" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "creative_arts",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "creative_arts",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const pool = CREATIVE_ARTS_ITEMS.filter((i) => !seen.has(i.id));
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const payload = response.payload as
      | { rubric?: { criteriaMet?: number; criteriaTotal?: number } }
      | undefined;
    const rubric = payload?.rubric;
    if (rubric && rubric.criteriaTotal && rubric.criteriaTotal > 0) {
      const mastery = (rubric.criteriaMet ?? 0) / rubric.criteriaTotal;
      return {
        mastery,
        confidence: 0.55,
        band:
          mastery >= 0.9
            ? "reflective"
            : mastery >= 0.7
              ? "consistent"
              : mastery >= 0.4
                ? "developing"
                : "emerging",
        feedback:
          mastery >= 0.7
            ? "All the target elements are in there."
            : "Try one more pass and add the element we talked about.",
      };
    }
    const correctness = response.correctness ?? 0;
    return {
      mastery: correctness,
      confidence: 0.6,
      feedback: correctness >= 0.7 ? "Right." : "Try another mix.",
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg =
      recent.reduce((s, r) => {
        const p = r.payload as
          | { rubric?: { criteriaMet?: number; criteriaTotal?: number } }
          | undefined;
        const rubric = p?.rubric;
        if (rubric && rubric.criteriaTotal && rubric.criteriaTotal > 0) {
          return s + (rubric.criteriaMet ?? 0) / rubric.criteriaTotal;
        }
        return s + (r.correctness ?? 0);
      }, 0) / recent.length;
    if (avg > 0.8)
      return { difficultyModulation: 1.1, rationale: "Consistent execution — open up the prompt." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "choice_grid",
        rationale: "Constrain the prompt — open canvas is overwhelming.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold." };
  }
}
