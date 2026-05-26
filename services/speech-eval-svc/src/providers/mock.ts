/**
 * Mock speech evaluation provider — dev / test only.
 *
 * Returns deterministic-ish per-word scores derived from word length so
 * the learner-surface flow renders without external ASR plumbing.
 * Production must NEVER boot with this provider (see `factory.ts`).
 */
import type { EvalOptions, EvalResult, SpeechEvalProvider } from "./index.js";

/** Deterministic per-word score (no randomness — needed for tests). */
function mockWordScore(word: string): number {
  // Range: 60..95, distributed across word length and char-code sums.
  const lenComponent = (word.length % 5) * 7;
  const charComponent =
    word.length === 0
      ? 0
      : (word.charCodeAt(0) + word.charCodeAt(word.length - 1)) % 15;
  return Math.max(0, Math.min(100, 60 + lenComponent + charComponent));
}

function buildResult(targetText: string, language: string): EvalResult {
  const words = targetText
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const perWord = words.map((w) => ({ word: w, score: mockWordScore(w) }));
  const pronunciation =
    perWord.length > 0
      ? Math.round(perWord.reduce((s, pw) => s + pw.score, 0) / perWord.length)
      : 72;
  // Deterministic fluency: tied to pronunciation with a stable offset.
  const fluency = Math.max(0, Math.min(100, pronunciation - 2));

  return {
    transcript: targetText,
    scores: { pronunciation, fluency, perWord },
    degraded: true,
    language,
  };
}

export class MockSpeechEvalProvider implements SpeechEvalProvider {
  readonly name = "mock" as const;
  async evaluate(
    _audio: Buffer,
    expectedText: string,
    opts: EvalOptions,
  ): Promise<EvalResult> {
    return buildResult(expectedText, opts.language);
  }
}
