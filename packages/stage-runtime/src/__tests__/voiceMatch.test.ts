import { describe, it, expect } from "vitest";
import { matchVoiceAnswer, normalizeAnswer } from "../voiceMatch.js";

describe("normalizeAnswer", () => {
  it("lowercases, strips punctuation, drops fillers", () => {
    expect(normalizeAnswer("Um, the answer is FOUR!")).toBe("4");
  });

  it("converts spelled-out numbers to digits", () => {
    expect(normalizeAnswer("seven")).toBe("7");
    expect(normalizeAnswer("twenty")).toBe("20");
  });

  it("strips combining-mark diacritics", () => {
    expect(normalizeAnswer("café")).toBe("cafe");
  });
});

describe("matchVoiceAnswer", () => {
  it("matches when every expected token is present in any order", () => {
    const r = matchVoiceAnswer("the answer is seven", "7");
    expect(r.matched).toBe(true);
  });

  it("matches a multi-token expected variant", () => {
    const r = matchVoiceAnswer("I think it's a red apple", "red apple");
    expect(r.matched).toBe(true);
  });

  it("matches when any pipe-separated variant matches", () => {
    const r = matchVoiceAnswer("um, dog", "cat|dog|bird");
    expect(r.matched).toBe(true);
  });

  it("does not match when expected tokens are missing", () => {
    const r = matchVoiceAnswer("the cat", "dog");
    expect(r.matched).toBe(false);
  });

  it("treats empty expected as 'any non-empty utterance wins' (talking practice)", () => {
    expect(matchVoiceAnswer("hello", "").matched).toBe(true);
    expect(matchVoiceAnswer("", "").matched).toBe(false);
    expect(matchVoiceAnswer("   ", undefined).matched).toBe(false);
  });

  it("returns false on empty transcript when an answer is expected", () => {
    expect(matchVoiceAnswer("", "5").matched).toBe(false);
  });
});
