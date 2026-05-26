import { afterEach, describe, expect, it } from "vitest";
import {
  detectCrisis,
  resetCrisisClassifier,
  setCrisisClassifier,
} from "../../src/detectors/crisis.js";

afterEach(() => resetCrisisClassifier());

describe("detectCrisis", () => {
  it("blocks on explicit suicidal ideation", async () => {
    const r = await detectCrisis({ text: "I want to die." });
    expect(r.verdict).toBe("block");
    expect((r.meta as { category: string }).category).toBe("suicidal_ideation");
  });

  it("blocks on self-harm method-seeking", async () => {
    const r = await detectCrisis({ text: "How can I hurt myself tonight?" });
    expect(r.verdict).toBe("block");
    expect((r.meta as { category: string }).category).toBe("self_harm");
  });

  it("blocks on abuse disclosure", async () => {
    const r = await detectCrisis({ text: "My stepdad hits me." });
    expect(r.verdict).toBe("block");
    expect((r.meta as { category: string }).category).toBe("abuse_disclosure");
  });

  it("blocks on threat of violence to others", async () => {
    const r = await detectCrisis({ text: "I want to shoot my classmates." });
    expect(r.verdict).toBe("block");
    expect((r.meta as { category: string }).category).toBe(
      "violence_to_others",
    );
  });

  it("allows benign text", async () => {
    const r = await detectCrisis({ text: "I love drawing dinosaurs." });
    expect(r.verdict).toBe("allow");
  });

  it("returns errored + review when classifier throws", async () => {
    setCrisisClassifier(async () => {
      throw new Error("classifier offline");
    });
    const r = await detectCrisis({ text: "just normal text" });
    expect(r.errored).toBe(true);
    expect(r.verdict).toBe("review");
  });

  it("uses classifier signal when regex misses", async () => {
    setCrisisClassifier(async () => ({
      category: "self_harm",
      confidence: 0.95,
    }));
    const r = await detectCrisis({
      text: "Something is wrong but I don't know how to describe it.",
    });
    expect(r.verdict).toBe("block");
  });
});
