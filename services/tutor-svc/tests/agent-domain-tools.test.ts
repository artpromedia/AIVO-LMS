/**
 * Wave E (S10) — domain tool adapter tests with a faked fetch.
 *
 * Every adapter must: hit the right backing-service endpoint with a
 * faithful payload, compact the response for the turn prompt, and turn
 * EVERY failure (HTTP error, refusal, missing input) into `{ error }` —
 * never a thrown turn, never fabricated assessment data.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeDomainTool, type DomainToolContext } from "../src/agent/tools.js";
import type { LessonObservation } from "../src/agent/orchestrator.js";

const OBSERVATION: LessonObservation = {
  beatIndex: 4,
  totalBeats: 8,
  beatKind: "guided",
  beatKinds: ["welcome", "goal", "micro", "example", "guided", "guided", "check", "celebrate"],
  prompt: "What is 3 x 4?",
  learnerResponse: "3 + 4 = 7",
  isCorrect: false,
  expectedAnswer: "12",
  recentMissStreak: 2,
  skillId: "ccss.3.oa.a.1",
};

const CTX: DomainToolContext = {
  learnerId: "11111111-1111-4111-8111-111111111111",
  observation: OBSERVATION,
};

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function fakeFetch(
  responder: (url: string, init: RequestInit) => { status: number; body: unknown },
  calls: CapturedCall[],
): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const { status, body } = responder(String(url), init ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as typeof fetch;
}

describe("read_math_work → math-recognizer-svc", () => {
  it("posts the learner's work and compacts the recognition", async () => {
    const calls: CapturedCall[] = [];
    const result = await executeDomainTool(
      "read_math_work",
      { typed_work: "3 + 4 = 7 so the answer is 7" },
      CTX,
      {
        fetchImpl: fakeFetch(
          () => ({
            status: 200,
            body: {
              recognizedExpression: "3 + 4 = 7",
              recognizedSteps: Array.from({ length: 9 }, (_, i) => ({
                id: `s${i}`,
                type: "calculation",
                value: `step ${i}`,
                confidence: 0.9,
              })),
              misconceptions: [
                {
                  id: "m1",
                  label: "added instead of multiplied",
                  evidence: "3 + 4 = 7 appears where 3 x 4 was asked",
                },
              ],
              feedbackHint: "Compare 'groups of' with 'plus'.",
              correctness: false,
              confidence: 0.82,
            },
          }),
          calls,
        ),
      },
    );

    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/math-recognizer/recognize"));
    const sent = JSON.parse(String(calls[0].init.body));
    assert.equal(sent.subject, "math");
    assert.equal(sent.learnerId, CTX.learnerId);
    assert.equal(sent.skillCode, "ccss.3.oa.a.1");
    assert.equal(sent.prompt, "What is 3 x 4?");
    assert.equal(sent.typedWork, "3 + 4 = 7 so the answer is 7");

    assert.equal(result.recognized_expression, "3 + 4 = 7");
    assert.equal((result.steps as unknown[]).length, 5, "steps capped for the prompt");
    assert.equal(
      (result.misconceptions as Array<{ label: string }>)[0].label,
      "added instead of multiplied",
    );
    assert.equal(result.correctness, false);
    assert.equal(result.feedback_hint, "Compare 'groups of' with 'plus'.");
  });

  it("turns an HTTP failure into { error } without throwing", async () => {
    const result = await executeDomainTool("read_math_work", {}, CTX, {
      fetchImpl: fakeFetch(() => ({ status: 503, body: { error: "down" } }), []),
    });
    assert.ok(typeof result.error === "string" && result.error.includes("503"));
  });
});

describe("evaluate_science_answer → science-solver-svc", () => {
  it("posts prompt + response and compacts the analysis", async () => {
    const calls: CapturedCall[] = [];
    const result = await executeDomainTool(
      "evaluate_science_answer",
      { topic: "states of matter" },
      CTX,
      {
        fetchImpl: fakeFetch(
          () => ({
            status: 200,
            body: {
              reasoningType: "observation",
              observedStrengths: ["names what they see"],
              missingElements: ["no cause stated"],
              misconceptionCandidates: [],
              nextHint: "Ask WHY the ice melted.",
              confidence: 0.7,
            },
          }),
          calls,
        ),
      },
    );
    assert.ok(calls[0].url.endsWith("/api/science-solver/analyze"));
    const sent = JSON.parse(String(calls[0].init.body));
    assert.equal(sent.response, OBSERVATION.learnerResponse);
    assert.equal(sent.topic, "states of matter");
    assert.equal(result.reasoning_type, "observation");
    assert.equal(result.next_hint, "Ask WHY the ice melted.");
  });
});

describe("score_pronunciation → speech-eval-svc", () => {
  it("refuses without audio instead of inventing scores", async () => {
    const calls: CapturedCall[] = [];
    const result = await executeDomainTool(
      "score_pronunciation",
      { target_text: "cat" },
      CTX,
      { fetchImpl: fakeFetch(() => ({ status: 200, body: {} }), calls) },
    );
    assert.ok(typeof result.error === "string" && result.error.includes("no audio"));
    assert.equal(calls.length, 0, "never calls the service without audio");
  });

  it("posts multipart audio + targetText and compacts the scores", async () => {
    const calls: CapturedCall[] = [];
    const audio = Buffer.from("fake-webm-bytes").toString("base64");
    const result = await executeDomainTool(
      "score_pronunciation",
      { target_text: "the cat sat", language: "en-US", audio_base64: audio },
      CTX,
      {
        fetchImpl: fakeFetch(
          () => ({
            status: 200,
            body: {
              transcript: "the cat sat",
              scores: {
                pronunciation: 0.91,
                fluency: 0.84,
                perWord: [
                  { word: "the", score: 0.95 },
                  { word: "cat", score: 0.9 },
                  { word: "sat", score: 0.88 },
                ],
              },
              degraded: true,
              language: "en-US",
            },
          }),
          calls,
        ),
      },
    );
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/speech-eval/evaluate"));
    const form = calls[0].init.body as FormData;
    assert.ok(form instanceof FormData, "multipart body");
    assert.equal(form.get("targetText"), "the cat sat");
    assert.equal(form.get("language"), "en-US");
    assert.ok(form.get("audio") instanceof Blob, "audio rides as a file part");

    assert.equal(result.pronunciation, 0.91);
    assert.equal(result.fluency, 0.84);
    assert.equal((result.per_word as unknown[]).length, 3);
    assert.equal(result.degraded, true);
  });

  it("passes a 503 ASR refusal through as an error", async () => {
    const audio = Buffer.from("bytes").toString("base64");
    const result = await executeDomainTool(
      "score_pronunciation",
      { target_text: "cat", audio_base64: audio },
      CTX,
      {
        fetchImpl: fakeFetch(
          () => ({ status: 503, body: { error: "Speech evaluation is temporarily unavailable" } }),
          [],
        ),
      },
    );
    assert.ok(typeof result.error === "string" && result.error.includes("503"));
  });
});

describe("break_down_task (in-process EF)", () => {
  it("breaks the current prompt into modality-tagged steps", async () => {
    const result = await executeDomainTool("break_down_task", {}, CTX, {});
    const steps = result.steps as Array<{ label: string; modality: string | null; weight: number }>;
    assert.ok(steps.length >= 3, "generic plan has multiple micro-steps");
    assert.ok(steps.every((s) => s.label.length > 0 && s.weight >= 1));
    assert.equal(
      result.total_weight,
      steps.reduce((a, s) => a + s.weight, 0),
    );
  });

  it("narrows to allowed modalities but never empties the plan", async () => {
    const narrowed = await executeDomainTool(
      "break_down_task",
      { title: "Write three sentences", modalities: ["visual"] },
      CTX,
      {},
    );
    const steps = narrowed.steps as Array<{ modality: string | null }>;
    assert.ok(steps.length >= 1);
    assert.ok(steps.every((s) => s.modality === null || s.modality === "visual"));
  });
});

describe("unknown tools", () => {
  it("resolves to an error payload", async () => {
    const result = await executeDomainTool("rm_rf", {}, CTX, {});
    assert.ok(typeof result.error === "string");
  });
});
