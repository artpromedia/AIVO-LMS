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
import { MUSIC_ITEMS } from "./items.js";

/**
 * Music brain (Sprint C.2 — completion plan).
 *
 * Drives `cadence` (`ADDON_TUTOR_ARTS`). NCAS K-2 anchors: steady
 * beat, rhythmic patterns, pitch direction, simple composition.
 *
 * Items that require audio production score on a 0..1 echo-accuracy
 * signal on `payload.score` (delivered by the voice surface). Items
 * that ask the learner to pick a higher/lower pitch or identify a
 * tempo grade on correctness directly.
 *
 * Functioning-level routing matters here: NON_VERBAL learners can
 * still keep a steady beat with body percussion, but the brain
 * suppresses voice-only echo items and falls back to
 * choice-grid + body-percussion alternatives.
 */
export class MusicBrain implements SubjectBrain {
  readonly subject = "music" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("music", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const level = request.functioningLevel ?? request.brainContext.functioningLevel;
    const nonVerbal = level === "NON_VERBAL" || level === "LOW_VERBAL";

    const lowerTopic = request.topic?.toLowerCase() ?? "";
    const recommendedSurfaces: string[] = [];
    if (/compose|create|write/.test(lowerTopic)) {
      recommendedSurfaces.push("scratchpad", "choice_grid");
    } else if (/pitch|high|low|melody/.test(lowerTopic)) {
      recommendedSurfaces.push("choice_grid");
    } else if (/beat|pattern|rhythm|clap/.test(lowerTopic)) {
      recommendedSurfaces.push(nonVerbal ? "choice_grid" : "voice_response", "choice_grid");
    } else {
      recommendedSurfaces.push("choice_grid");
    }

    const recommendedScaffolds: string[] = [
      "Model the rhythm or pitch contrast twice before the learner attempts it.",
      "Body percussion (claps, stomps) is always a valid substitute for vocal echo.",
      "Celebrate steady beat — pitch accuracy comes after beat fluency.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: code.startsWith("NCAS") ? "NCAS" : "Custom",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "music",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "music",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    const seen = new Set(state.recentItemIds ?? []);
    const nonVerbal =
      state.functioningLevel === "NON_VERBAL" || state.functioningLevel === "LOW_VERBAL";
    let pool = MUSIC_ITEMS.filter((i) => !seen.has(i.id));
    if (nonVerbal) {
      pool = pool.filter((i) => i.surface !== "voice_response");
    }
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const payload = response.payload as { score?: number } | undefined;
    const mastery =
      typeof payload?.score === "number" ? payload.score : (response.correctness ?? 0);
    const feedback =
      mastery >= 0.8
        ? "Right on the beat."
        : mastery >= 0.5
          ? "Close — listen one more time and try again."
          : "Tap the beat with one finger first, then echo.";
    return { mastery, confidence: 0.6, feedback };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    const recent = history.slice(-5);
    if (recent.length === 0) return { difficultyModulation: 1.0, rationale: "No history." };
    const avg =
      recent.reduce((s, r) => {
        const p = r.payload as { score?: number } | undefined;
        return s + (typeof p?.score === "number" ? p.score : (r.correctness ?? 0));
      }, 0) / recent.length;
    if (avg > 0.8)
      return { difficultyModulation: 1.1, rationale: "Beat stable — add a pitch dimension." };
    if (avg < 0.4)
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "choice_grid",
        rationale: "Drop to listen-and-identify before re-attempting production.",
      };
    return { difficultyModulation: 1.0, rationale: "Hold and consolidate beat fluency." };
  }
}
