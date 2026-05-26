/**
 * Local transcript-vs-expected scoring (Sprint 12.5).
 *
 * Providers that return only a transcript (Whisper, basic Deepgram) use
 * this helper to derive pronunciation + fluency scores so the route can
 * return the same `EvalResult` shape regardless of provider.
 *
 * Approach:
 *   - Tokenise both strings (lowercase, strip punctuation).
 *   - Per-word: 100 if the transcript contains an exact match at the
 *     same index, 65 if it appears elsewhere in the transcript
 *     (mispronunciation that ASR still recognised), 0 if missing.
 *   - Pronunciation = mean per-word score (or 0 when expected is empty).
 *   - Fluency = pronunciation discounted by the magnitude of length
 *     mismatch (extra/missing words → less smooth delivery).
 */

export interface ScoringResult {
  pronunciation: number;
  fluency: number;
  perWord: Array<{ word: string; score: number }>;
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/gi, "")
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreTranscriptAgainstExpected(
  transcript: string,
  expected: string,
): ScoringResult {
  const expectedTokens = tokenise(expected);
  const transcriptTokens = tokenise(transcript);

  if (expectedTokens.length === 0) {
    return { pronunciation: 0, fluency: 0, perWord: [] };
  }

  const transcriptSet = new Set(transcriptTokens);
  const perWord = expectedTokens.map((word, i) => {
    if (transcriptTokens[i] === word) return { word, score: 100 };
    if (transcriptSet.has(word)) return { word, score: 65 };
    return { word, score: 0 };
  });

  const pronunciation = Math.round(
    perWord.reduce((s, pw) => s + pw.score, 0) / perWord.length,
  );

  const lenDelta = Math.abs(transcriptTokens.length - expectedTokens.length);
  // Each extra/missing word costs up to ~5 points of fluency, capped.
  const fluencyPenalty = Math.min(40, lenDelta * 5);
  const fluency = Math.max(0, pronunciation - fluencyPenalty);

  return { pronunciation, fluency, perWord };
}
