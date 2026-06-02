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
import { SPEECH_ITEMS } from "./items.js";

/**
 * Speech brain (Sprint D — completion plan).
 *
 * Wraps the articulation / phonology / fluency progression that
 * `speech-eval-svc` is the *scoring* backend for. The brain owns the
 * pedagogical sequence and the next-item selection; the actual ASR /
 * pronunciation score for each voice attempt is delegated to
 * speech-eval-svc and arrives as `payload.score`.
 *
 * Functioning-level considerations matter more here than in any other
 * subject: a NON_VERBAL or LOW_VERBAL learner cannot produce voice
 * items. The brain swaps to choice-grid identification items
 * automatically when the profile flags low verbalization.
 */
export class SpeechBrain implements SubjectBrain {
  readonly subject = "speech" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("speech", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const level = request.functioningLevel ?? request.brainContext.functioningLevel;
    const lowVerbal = level === "NON_VERBAL" || level === "LOW_VERBAL";

    const recommendedSurfaces: string[] = lowVerbal
      ? ["choice_grid"]
      : ["voice_response", "choice_grid"];

    const recommendedScaffolds: string[] = lowVerbal
      ? [
          "Skip voice production tasks; route to sound identification only.",
          "Pair every audio prompt with a picture choice.",
          "Allow learner to point or tap instead of speaking.",
        ]
      : [
          "Model the target sound twice before asking for a response.",
          "Praise the attempt, not just the accuracy — articulation is gradual.",
          "Keep sessions short — 5 minutes of articulation is plenty.",
        ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("ASHA") ? "ASHA" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "speech",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "speech",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const lowVerbal =
      state.functioningLevel === "NON_VERBAL" || state.functioningLevel === "LOW_VERBAL";
    let pool = SPEECH_ITEMS.filter((i) => !seen.has(i.id));
    if (lowVerbal) {
      pool = pool.filter((i) => i.surface !== "voice_response");
    }
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    // Voice items: speech-eval-svc returns a 0..1 articulation score on
    // payload.score; per-phoneme detail in payload.perPhoneme. Identification
    // items grade on correctness directly.
    const payload = response.payload as { score?: number; perPhoneme?: unknown } | undefined;
    const mastery =
      typeof payload?.score === "number" ? payload.score : (response.correctness ?? 0);
    const feedback =
      mastery >= 0.8
        ? "Clear and confident — well done."
        : mastery >= 0.5
          ? "Closer. Try the sound a little longer."
          : "Let's listen and try again together.";
    return { mastery, confidence: 0.6, feedback };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg =
      recent.reduce((s, r) => {
        const p = r.payload as { score?: number } | undefined;
        const v = typeof p?.score === "number" ? p.score : (r.correctness ?? 0);
        return s + v;
      }, 0) / recent.length;
    if (avg > 0.8)
      return { difficultyModulation: 1.1, rationale: "Articulation stable — step up." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.8,
        recommendedSurface: "choice_grid",
        rationale: "Drop to identification — production isn't there yet.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold and consolidate." };
  }
}
