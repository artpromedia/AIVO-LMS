import { describe, it, expect } from "vitest";
import type { BaselineItem, ItemResponse } from "@aivo/adaptive-baseline";
import type { BaselineQuestion } from "@/lib/db/types";
import {
  adaptiveBaselineEndpoint,
  questionsToBank,
  startAdaptiveBaselineRun,
  respondAdaptiveBaselineRun,
  finalizeAdaptiveBaselineRun,
} from "./baseline-stream";

const BASE = "http://assessment-svc.test";
const TOKEN = "test-jwt";

function item(id: string, difficulty = 0): BaselineItem {
  return { id, skillId: `sk_${id}`, difficulty, modalities: ["reading"], lightReading: false };
}

/** A fetch double that records the last call and returns a canned Response. */
function fakeFetch(status: number, payload: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("adaptiveBaselineEndpoint", () => {
  it("builds the per-action URL and trims trailing slashes", () => {
    expect(adaptiveBaselineEndpoint("lrn1", "start", "http://x/")).toBe(
      "http://x/api/assessments/adaptive-baseline/lrn1/start",
    );
    expect(adaptiveBaselineEndpoint("lrn1", "respond", "http://x")).toBe(
      "http://x/api/assessments/adaptive-baseline/lrn1/respond",
    );
  });
});

describe("questionsToBank", () => {
  it("maps the difficulty enum onto the engine's theta scale", () => {
    const q: BaselineQuestion = {
      id: "q1",
      baselineId: "b1",
      subjectId: "s1",
      skillId: "sk1",
      order: 1,
      prompt: "p",
      difficulty: "stretch",
      accommodationTags: [],
    };
    const [mapped] = questionsToBank([q]);
    expect(mapped!.id).toBe("q1");
    expect(mapped!.difficulty).toBeGreaterThan(0);
  });
});

describe("startAdaptiveBaselineRun", () => {
  it("POSTs the bank + prior to /start and parses the next item", async () => {
    const next = item("a1", -0.3);
    const { impl, calls } = fakeFetch(200, {
      sessionId: "sess1",
      learnerId: "lrn1",
      nextItem: next,
      stop: { stop: false, reason: "min_items_pending", se: 1 },
    });
    const res = await startAdaptiveBaselineRun({
      learnerId: "lrn1",
      bank: [item("a1", -0.3), item("g1", 0.4)],
      priorTheta: 0.1,
      authToken: TOKEN,
      baseUrl: BASE,
      fetchImpl: impl,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sessionId).toBe("sess1");
    expect(res.nextItem?.id).toBe("a1");

    expect(calls[0]!.url).toBe(`${BASE}/api/assessments/adaptive-baseline/lrn1/start`);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.priorTheta).toBe(0.1);
    expect(body.bank).toHaveLength(2);
  });
});

describe("respondAdaptiveBaselineRun", () => {
  it("POSTs itemId + response and parses theta/nextItem", async () => {
    const { impl, calls } = fakeFetch(200, {
      sessionId: "sess1",
      nextItem: item("g1", 0.4),
      stop: { stop: false, reason: "in_progress", se: 0.6 },
      theta: 0.17,
    });
    const response: ItemResponse = { itemId: "a1", correct: true, responseTimeMs: 1200 };
    const res = await respondAdaptiveBaselineRun({
      learnerId: "lrn1",
      sessionId: "sess1",
      item: item("a1", -0.3),
      response,
      bank: [item("a1", -0.3), item("g1", 0.4)],
      authToken: TOKEN,
      baseUrl: BASE,
      fetchImpl: impl,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.theta).toBe(0.17);
    expect(res.nextItem?.id).toBe("g1");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.itemId).toBe("a1");
    expect(body.sessionId).toBe("sess1");
  });

  it("surfaces a 409 integrity rejection as response_rejected", async () => {
    const { impl } = fakeFetch(409, { error: "response_rejected", reason: "unexpected_item" });
    const res = await respondAdaptiveBaselineRun({
      learnerId: "lrn1",
      sessionId: "sess1",
      item: item("a1"),
      response: { itemId: "a1", correct: true, responseTimeMs: 0 },
      bank: [item("a1")],
      authToken: TOKEN,
      baseUrl: BASE,
      fetchImpl: impl,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("response_rejected");
    expect(res.rejection).toBe("unexpected_item");
  });
});

describe("finalizeAdaptiveBaselineRun", () => {
  it("parses the final placement + learning profile", async () => {
    const { impl } = fakeFetch(200, {
      sessionId: "sess1",
      finalTheta: 0.42,
      itemsAdministered: 8,
      learningProfile: { thetaPlacement: 0.4, frustrationTolerance: "high" },
    });
    const res = await finalizeAdaptiveBaselineRun({
      learnerId: "lrn1",
      sessionId: "sess1",
      bank: [item("a1")],
      authToken: TOKEN,
      baseUrl: BASE,
      fetchImpl: impl,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.finalTheta).toBe(0.42);
    expect(res.itemsAdministered).toBe(8);
  });
});

describe("transport failures", () => {
  it("tags a non-2xx as non_2xx with status", async () => {
    const { impl } = fakeFetch(500, { error: "boom" });
    const res = await startAdaptiveBaselineRun({
      learnerId: "lrn1",
      bank: [item("a1")],
      authToken: TOKEN,
      baseUrl: BASE,
      fetchImpl: impl,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("non_2xx");
    expect(res.status).toBe(500);
  });

  it("tags an aborted request as timeout", async () => {
    const impl = (async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }) as unknown as typeof fetch;
    const res = await startAdaptiveBaselineRun({
      learnerId: "lrn1",
      bank: [item("a1")],
      authToken: TOKEN,
      baseUrl: BASE,
      fetchImpl: impl,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("timeout");
  });
});
