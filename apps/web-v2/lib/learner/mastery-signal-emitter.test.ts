import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLessonMasterySignal,
  emitLessonMasterySignal,
  type LessonMasteryMovement,
} from "./mastery-signal-emitter";

const movement: LessonMasteryMovement = {
  skillId: "skl-1",
  subjectId: "sub-1",
  before: 0.5,
  after: 0.7,
  levelBefore: "approaching",
  levelAfter: "on_grade_level",
  confidence: 0.65,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("buildLessonMasterySignal", () => {
  it("carries the metadata the progression rules read", () => {
    const signal = buildLessonMasterySignal(movement);
    expect(signal.metric).toBe("mastery_signal");
    expect(signal.value).toBe(0.7);
    expect(signal.metadata).toEqual({
      skillId: "skl-1",
      subjectId: "sub-1",
      before: 0.5,
      after: 0.7,
      levelBefore: "approaching",
      levelAfter: "on_grade_level",
      confidence: 0.65,
    });
  });
});

describe("emitLessonMasterySignal", () => {
  it("is a no-op when the v2 flag is off", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    await emitLessonMasterySignal({ tenantId: "t", learnerId: "l", movement });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("posts the candidates payload when the flag is on, and swallows failures", async () => {
    vi.stubEnv("AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2", "1");
    // serverEnv is cached at import; re-import the module with the env set.
    vi.resetModules();
    const mod = await import("./mastery-signal-emitter");
    const fetchFn = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchFn);
    await mod.emitLessonMasterySignal({
      tenantId: "t-1",
      learnerId: "lrn-1",
      movement,
      currentProfile: { gradeBand: "5", baselineCompletedAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]! as unknown as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/recommendations\/candidates$/);
    const body = JSON.parse(String(init.body));
    expect(body.learnerId).toBe("lrn-1");
    expect(body.signals[0].metadata.skillId).toBe("skl-1");
    expect(body.currentProfile.gradeBand).toBe("5");

    // Network failure must not throw.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    await expect(
      mod.emitLessonMasterySignal({ tenantId: "t", learnerId: "l", movement }),
    ).resolves.toBeUndefined();
  });
});
