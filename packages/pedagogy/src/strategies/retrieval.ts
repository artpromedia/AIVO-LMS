/**
 * Retrieval-practice strategy — picks a previously-mastered skill to
 * re-test, biased toward skills whose retrieval strength has decayed
 * since last review. This is the "test-enhanced learning" mechanism: the
 * act of retrieving content from memory strengthens future recall more
 * than re-presenting the content.
 *
 * Strength model (cf. Bjork & Bjork): a skill's retrieval strength is the
 * exponential decay of (mastery × time-since-review-fraction).
 */
import type { MasteryRecord } from "../types.js";

export interface RetrievalInput {
  /** All skills the learner has ever practiced, with current mastery. */
  catalog: MasteryRecord[];
  /** Skills the runtime has just covered — exclude them from retrieval. */
  recentlyCovered: readonly string[];
  /** Now, ISO-8601, default `new Date()`. */
  now?: string;
  /** Required minimum mastery for a skill to be eligible for retrieval. */
  minMastery?: number;
  /** Up to N skills to surface. */
  topK?: number;
}

export interface RetrievalDecision {
  /** Ordered, highest-priority retrieval candidates first. */
  candidates: Array<{ skillId: string; strength: number }>;
}

/** Half-life for retrieval strength, days. Aligned with SM-2 mid-band. */
const HALFLIFE_DAYS = 14;

export function retrieve(input: RetrievalInput): RetrievalDecision {
  const minMastery = input.minMastery ?? 0.5;
  const topK = input.topK ?? 3;
  const recentSet = new Set(input.recentlyCovered);
  const now = input.now ? new Date(input.now).getTime() : Date.now();

  const scored = input.catalog
    .filter((m) => m.mastery >= minMastery && !recentSet.has(m.skillId))
    .map((m) => {
      const last = m.lastReviewedAt ? new Date(m.lastReviewedAt).getTime() : now;
      const ageDays = Math.max(0, (now - last) / 86_400_000);
      const decay = Math.pow(0.5, ageDays / HALFLIFE_DAYS);
      const strength = m.mastery * decay;
      return { skillId: m.skillId, strength };
    })
    // Pick weakest-retrieval-strength first (biggest forgetting risk).
    .sort((a, b) => a.strength - b.strength)
    .slice(0, topK);

  return { candidates: scored };
}
