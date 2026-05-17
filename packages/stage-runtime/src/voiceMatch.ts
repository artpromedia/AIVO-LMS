/**
 * voiceMatch — match a Whisper / Web-Speech transcript against an expected
 * answer. STT output is noisy: punctuation, casing, articles, numbers vs.
 * number-words, trailing "uh"s, accent diacritics. We normalize both sides
 * and check for equality or containment. Multiple acceptable answers can
 * be separated by "|".
 *
 * Extracted from apps/web/src/components/stage/voiceMatch.ts as part of the
 * §8 #2 Stage extraction (v2.1).
 */

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5",
  sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
};

const FILLER_TOKENS = new Set([
  "a", "an", "the", "is", "it", "it's", "its", "that", "this",
  "um", "uh", "er", "like", "well", "so", "yeah", "okay", "ok",
  "i", "i'd", "id", "i'll", "ill", "i'm", "im",
  "say", "think", "guess", "answer",
]);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(s: string): string[] {
  const cleaned = stripDiacritics(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned
    .split(" ")
    .map((tok) => NUMBER_WORDS[tok] ?? tok)
    .filter((tok) => tok && !FILLER_TOKENS.has(tok));
}

export function normalizeAnswer(s: string): string {
  return tokenize(s).join(" ");
}

export interface MatchResult {
  matched: boolean;
  normalizedTranscript: string;
  normalizedExpected: string;
}

// Returns true if any of the "|"-separated expected variants matches the
// transcript. A match is direct-equal OR every token of the expected variant
// appears (in any order) in the transcript token list.
export function matchVoiceAnswer(
  transcript: string,
  expected: string | undefined,
): MatchResult {
  const normTranscript = normalizeAnswer(transcript);
  // No expected answer => "talking practice" beat: any non-empty utterance wins.
  if (!expected || !expected.trim()) {
    return {
      matched: normTranscript.length > 0,
      normalizedTranscript: normTranscript,
      normalizedExpected: "",
    };
  }

  const transcriptTokens = tokenize(transcript);
  if (transcriptTokens.length === 0) {
    return {
      matched: false,
      normalizedTranscript: normTranscript,
      normalizedExpected: normalizeAnswer(expected),
    };
  }
  const transcriptSet = new Set(transcriptTokens);

  const variants = expected
    .split("|")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  for (const variant of variants) {
    const variantTokens = tokenize(variant);
    if (variantTokens.length === 0) continue;
    if (variantTokens.every((tok) => transcriptSet.has(tok))) {
      return {
        matched: true,
        normalizedTranscript: normTranscript,
        normalizedExpected: variantTokens.join(" "),
      };
    }
  }

  return {
    matched: false,
    normalizedTranscript: normTranscript,
    normalizedExpected: normalizeAnswer(expected),
  };
}
