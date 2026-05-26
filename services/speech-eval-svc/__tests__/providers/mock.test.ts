import { describe, expect, it } from "vitest";
import { MockSpeechEvalProvider } from "../../src/providers/mock.js";

describe("MockSpeechEvalProvider", () => {
  it("returns deterministic scores for the same input", async () => {
    const p = new MockSpeechEvalProvider();
    const a = await p.evaluate(Buffer.from(""), "the quick brown fox", { language: "en-US" });
    const b = await p.evaluate(Buffer.from(""), "the quick brown fox", { language: "en-US" });
    expect(a).toEqual(b);
  });

  it("echoes the target text as transcript and flags degraded", async () => {
    const p = new MockSpeechEvalProvider();
    const r = await p.evaluate(Buffer.from(""), "hello world", { language: "en-US" });
    expect(r.transcript).toBe("hello world");
    expect(r.degraded).toBe(true);
    expect(r.language).toBe("en-US");
    expect(r.scores.perWord).toHaveLength(2);
  });

  it("produces pronunciation in 0..100 range", async () => {
    const p = new MockSpeechEvalProvider();
    const r = await p.evaluate(Buffer.from(""), "a b c", { language: "en-US" });
    expect(r.scores.pronunciation).toBeGreaterThanOrEqual(0);
    expect(r.scores.pronunciation).toBeLessThanOrEqual(100);
    expect(r.scores.fluency).toBeGreaterThanOrEqual(0);
    expect(r.scores.fluency).toBeLessThanOrEqual(100);
  });
});
