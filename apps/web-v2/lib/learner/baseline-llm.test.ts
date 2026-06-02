/**
 * Sprint B1 — unit tests for the assessment-svc baseline fetcher.
 *
 * Uses a fetch mock (rather than msw) to keep the test surface small
 * and free of new dev dependencies. Covers the four failure modes the
 * Sprint B2 wiring will fall back on (network/timeout/non-2xx/invalid
 * schema/too-few-questions) plus the happy path.
 */
import { describe, expect, it } from "vitest";
import {
  baselineLlmEndpoint,
  generateBaselineQuestionsViaLLM,
  type GenerateBaselineViaLlmInput,
} from "@/lib/learner/baseline-llm";
import { BASELINE_LLM_REQUIRED_SUBJECTS } from "@/lib/validators/baseline-llm";

function makeValidQuestion(idx: number) {
  const subject = BASELINE_LLM_REQUIRED_SUBJECTS[idx % BASELINE_LLM_REQUIRED_SUBJECTS.length]!;
  return {
    id: `q_${idx}`,
    subject,
    questionText: `Question ${idx}`,
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
    correctAnswer: "a",
  };
}

function makeValidResponse(count = 14) {
  return {
    questions: Array.from({ length: count }, (_, i) => makeValidQuestion(i)),
    subjects: [...BASELINE_LLM_REQUIRED_SUBJECTS],
    model: "test-model",
    prompt_tokens: 100,
    completion_tokens: 200,
  };
}

function fetchReturning(
  init: { status?: number; json?: unknown; body?: string } | (() => never),
): typeof fetch {
  if (typeof init === "function") {
    return init as unknown as typeof fetch;
  }
  return (async () => {
    const status = init.status ?? 200;
    const ok = status >= 200 && status < 300;
    return {
      ok,
      status,
      async json() {
        if ("json" in init) return init.json;
        throw new Error("no json body");
      },
      async text() {
        return init.body ?? JSON.stringify(init.json ?? {});
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

const baseInput: GenerateBaselineViaLlmInput = {
  parent_assessment: { foo: "bar" },
  functioning_level: "STANDARD",
  baseUrl: "http://assessment.test",
};

describe("baselineLlmEndpoint", () => {
  it("joins base + path without producing a double slash", () => {
    expect(baselineLlmEndpoint("http://x")).toBe("http://x/api/ai/generate-baseline");
    expect(baselineLlmEndpoint("http://x/")).toBe("http://x/api/ai/generate-baseline");
    expect(baselineLlmEndpoint("http://x///")).toBe("http://x/api/ai/generate-baseline");
  });
});

describe("generateBaselineQuestionsViaLLM — happy path", () => {
  it("returns ok=true with the parsed response on a valid 200", async () => {
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: fetchReturning({ status: 200, json: makeValidResponse(14) }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.questions.length).toBe(14);
      expect(result.response.model).toBe("test-model");
    }
  });

  it("POSTs to the assessment-svc endpoint with a JSON body", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const mock: typeof fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        async json() {
          return makeValidResponse(14);
        },
        async text() {
          return "";
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await generateBaselineQuestionsViaLLM({ ...baseInput, fetchImpl: mock });

    expect(capturedUrl).toBe("http://assessment.test/api/ai/generate-baseline");
    expect(capturedInit?.method).toBe("POST");
    const body = JSON.parse((capturedInit?.body as string) ?? "{}");
    expect(body.parent_assessment).toEqual({ foo: "bar" });
    expect(body.functioning_level).toBe("STANDARD");
    // baseUrl/fetchImpl/timeoutMs are control fields and must not leak
    // into the wire payload.
    expect(body.baseUrl).toBeUndefined();
    expect(body.fetchImpl).toBeUndefined();
    expect(body.timeoutMs).toBeUndefined();
  });
});

describe("generateBaselineQuestionsViaLLM — failure modes", () => {
  it("returns reason=non_2xx on a 502 from the proxy", async () => {
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: fetchReturning({ status: 502, body: "upstream broken" }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("non_2xx");
      expect(result.status).toBe(502);
    }
  });

  it("returns reason=network_error when fetch throws a non-Abort error", async () => {
    const mock: typeof fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: mock,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("network_error");
      expect(result.message).toContain("ECONNREFUSED");
    }
  });

  it("returns reason=timeout when fetch is aborted", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const mock: typeof fetch = (async () => {
      throw abortErr;
    }) as unknown as typeof fetch;
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: mock,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("timeout");
    }
  });

  it("returns reason=invalid_json when response body isn't JSON", async () => {
    const mock: typeof fetch = (async () => {
      return {
        ok: true,
        status: 200,
        async json() {
          throw new Error("Unexpected token");
        },
        async text() {
          return "<html>not json</html>";
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: mock,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_json");
    }
  });

  it("returns reason=schema_validation_failed when correctAnswer not in options", async () => {
    const bad = makeValidResponse(14);
    bad.questions[0]!.correctAnswer = "not-an-option";
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: fetchReturning({ status: 200, json: bad }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("schema_validation_failed");
    }
  });

  it("returns reason=schema_validation_failed when subject is not in REQUIRED_SUBJECTS", async () => {
    const bad = makeValidResponse(14);
    (bad.questions[0] as unknown as { subject: string }).subject = "not-a-subject";
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: fetchReturning({ status: 200, json: bad }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("schema_validation_failed");
    }
  });

  it("returns reason=too_few_questions when fewer than MIN are returned", async () => {
    const result = await generateBaselineQuestionsViaLLM({
      ...baseInput,
      fetchImpl: fetchReturning({ status: 200, json: makeValidResponse(3) }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_few_questions");
    }
  });
});
