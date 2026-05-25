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
import { EF_ITEMS } from "./items.js";

/**
 * Executive-Function brain.
 *
 * Item-level evidence here is *task-performance proxies*, not pass/fail
 * correctness: latency (how long an item took), correction count (how
 * many times the learner reverted a choice), and sequence completion.
 * Slow + many corrections = high cognitive load, not "wrong."
 *
 * Difficulty modulation uses IRT-lite (3PL) on the latency-weighted
 * correctness signal, but never on raw correctness alone.
 */
export class ExecutiveFunctionBrain implements SubjectBrain {
  readonly subject = "executive_function" as const;

  context(request: SubjectContextRequest): SubjectContextResponse {
    const skills = findSkillsByTopic("executive_function", request.topic);
    const relevantSkills = skills.map((s) => s.code);
    const prereqs = getPrerequisitesFor(relevantSkills);

    const recommendedSurfaces = ["multi_step_workspace", "drag_manipulative", "choice_grid"];
    const recommendedScaffolds = [
      "Externalize working memory: keep the rule visible while solving.",
      "Pre-announce a switch (\"new rule next!\") to support flexibility.",
      "Chunk multi-step tasks; check off each step.",
    ];

    const standards: StandardReference[] = getStandardsFor(relevantSkills).map((code) => ({
      framework: "EF",
      code,
      description: `Aligns to ${code}`,
    }));

    return {
      subject: "executive_function",
      topic: request.topic,
      relevantSkills,
      prerequisiteSkills: prereqs,
      masteryGaps: [],
      misconceptionRisks: [],
      recommendedSurfaces,
      recommendedScaffolds,
      standards,
      profileAdaptations: buildProfileAdaptations(
        "executive_function",
        request.brainContext,
        request.functioningLevel,
      ),
    };
  }

  selectNextItem(state: LearnerState, _graph: SkillGraphView): Item | undefined {
    // 3PL pick: prefer item whose difficulty is closest to learner theta.
    const seen = new Set(state.recentItemIds ?? []);
    const pool = EF_ITEMS.filter((i) => !seen.has(i.id));
    if (pool.length === 0) return undefined;
    return pool.sort(
      (a, b) => Math.abs(a.difficulty - state.theta) - Math.abs(b.difficulty - state.theta),
    )[0];
  }

  score(response: ItemResponse): ScoreResult {
    const correctness = response.correctness ?? 0;
    const latency = response.responseTimeMs ?? 0;
    const corrections = response.corrections ?? 0;

    // Latency penalty: very fast (<300ms) likely a guess; very slow
    // (>30s) implies high cognitive load even if correct.
    const latencyPenalty = latency < 300 ? 0.2 : latency > 30000 ? 0.15 : 0;
    const correctionPenalty = Math.min(corrections * 0.08, 0.3);
    const mastery = Math.max(0, Math.min(1, correctness - latencyPenalty - correctionPenalty));
    const confidence = correctness > 0.8 && corrections === 0 ? 0.85 : 0.55;
    return {
      mastery,
      confidence,
      feedback:
        corrections > 1
          ? "You changed your mind a few times — that's flexible thinking. Let's slow the pace."
          : correctness > 0.8
            ? "Sharp — you held the rule and applied it."
            : "Good attempt. The rule will get easier to hold with practice.",
    };
  }

  adapt(history: ItemResponse[]): AdaptDirective {
    if (history.length === 0) {
      return { difficultyModulation: 1.0, rationale: "No history; hold pace." };
    }
    const recent = history.slice(-5);
    const avgCorrections =
      recent.reduce((s, r) => s + (r.corrections ?? 0), 0) / recent.length;
    const avgLatency = recent.reduce((s, r) => s + (r.responseTimeMs ?? 0), 0) / recent.length;
    const avgCorrect = recent.reduce((s, r) => s + (r.correctness ?? 0), 0) / recent.length;

    if (avgCorrect > 0.85 && avgCorrections < 0.5 && avgLatency < 8000) {
      return { difficultyModulation: 1.15, rationale: "Strong + fast + no flailing — step up." };
    }
    if (avgCorrections > 1.5 || avgLatency > 20000) {
      return {
        difficultyModulation: 0.85,
        recommendedSurface: "choice_grid",
        rationale: "High corrections / long latency — drop load.",
      };
    }
    return { difficultyModulation: 1.0, rationale: "Maintain current difficulty." };
  }
}
