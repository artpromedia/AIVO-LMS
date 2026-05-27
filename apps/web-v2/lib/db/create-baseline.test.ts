/**
 * Sprint B2 — `createBaseline` LLM-first wiring tests.
 *
 * Covers the four code paths the rollout depends on:
 *   • AIVO_FEATURE_BASELINE_LLM flag OFF → BANK fallback, metadata flags
 *     source="fallback", reason="flag_off"
 *   • Flag ON + LLM success → metadata flags source="ai" with model +
 *     token counts persisted on `BaselineAssessment.generationMetadata`
 *   • Flag ON + LLM HTTP timeout → BANK fallback, reason="timeout"
 *   • Flag ON + LLM returns schema-invalid JSON → BANK fallback,
 *     reason="schema_validation_failed"
 *
 * The fetcher is monkey-patched via `globalThis.fetch` so the test
 * never makes a real network call.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import {
  createBaseline,
  getOrCreateParentAssessment,
  submitParentAssessment,
} from "@/lib/db/repos";
import { BASELINE_LLM_REQUIRED_SUBJECTS } from "@/lib/validators/baseline-llm";

const LEARNER_ID = "lrn_demo_sky";
const TENANT_ID = "t_demo";

function makeValidLlmResponse(count = 14) {
  const questions = Array.from({ length: count }, (_, i) => ({
    id: `q_${i}`,
    // Cycle through subjects so we hit "math" + "ela" (mapped to
    // "math" + "reading" in web-v2 slugs).
    subject:
      BASELINE_LLM_REQUIRED_SUBJECTS[i % BASELINE_LLM_REQUIRED_SUBJECTS.length]!,
    questionText: `Question ${i}?`,
    options: [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ],
    correctAnswer: "a",
  }));
  return {
    questions,
    subjects: [...BASELINE_LLM_REQUIRED_SUBJECTS],
    model: "claude-3-5-sonnet",
    prompt_tokens: 1234,
    completion_tokens: 567,
  };
}

function primeSubmittedParentAssessment(): void {
  // Mark the seeded parent assessment as submitted so the LLM gate
  // (which requires `parentAssessment.submittedAt`) is satisfied.
  getOrCreateParentAssessment(LEARNER_ID, TENANT_ID);
  submitParentAssessment(LEARNER_ID, TENANT_ID);
}

describe("createBaseline — Sprint B2 LLM wiring", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    resetStore();
    ensureSeeded();
    originalFetch = globalThis.fetch;
    // Default the flag OFF; each test that wants the LLM path on
    // toggles it explicitly via vi.stubEnv.
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("falls back to BANK when AIVO_FEATURE_BASELINE_LLM is OFF", async () => {
    vi.stubEnv("AIVO_FEATURE_BASELINE_LLM", "false");
    vi.stubEnv("NODE_ENV", "production"); // also turn off the dev default
    primeSubmittedParentAssessment();

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await createBaseline({ learnerId: LEARNER_ID, tenantId: TENANT_ID });
    expect(result).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result!.baseline.generationMetadata).toMatchObject({
      source: "fallback",
      fallbackReason: "flag_off",
    });
    expect(result!.questions.length).toBeGreaterThan(0);
  });

  it("uses the LLM path when the flag is ON and the call succeeds", async () => {
    vi.stubEnv("AIVO_FEATURE_BASELINE_LLM", "true");
    primeSubmittedParentAssessment();

    // The createBaseline flow tries the Discovery Adventure first (one fetch
    // per chapter), then falls back to the flat /api/ai/generate-baseline
    // path. This test exercises the flat-LLM happy path, so we 404 the
    // discovery chapter calls (forcing the discovery fallback) and serve
    // the LLM fixture only on the flat endpoint.
    const fetchMock = vi.fn().mockImplementation((url: string | URL) => {
      const href = typeof url === "string" ? url : url.toString();
      if (href.includes("/api/ai/generate-baseline")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          async json() {
            return makeValidLlmResponse(14);
          },
          async text() {
            return "";
          },
        });
      }
      // Force discovery to bail so the flat-LLM branch executes.
      return Promise.resolve({
        ok: false,
        status: 404,
        async json() {
          return {};
        },
        async text() {
          return "";
        },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createBaseline({ learnerId: LEARNER_ID, tenantId: TENANT_ID });
    expect(result).not.toBeNull();
    const flatLlmCalls = fetchMock.mock.calls.filter((c) => {
      const u = c[0];
      const href = typeof u === "string" ? u : u instanceof URL ? u.toString() : "";
      return href.includes("/api/ai/generate-baseline");
    });
    expect(flatLlmCalls).toHaveLength(1);
    const meta = result!.baseline.generationMetadata;
    expect(meta).toMatchObject({
      source: "ai",
      model: "claude-3-5-sonnet",
      promptTokens: 1234,
      completionTokens: 567,
    });
    // LLM-mapped questions should land — at minimum the math + reading
    // subjects from the cycling fixture map.
    expect(result!.questions.length).toBeGreaterThan(0);
  });

  it("falls back to BANK on a timeout, with reason=timeout", async () => {
    vi.stubEnv("AIVO_FEATURE_BASELINE_LLM", "true");
    primeSubmittedParentAssessment();

    const fetchMock = vi.fn().mockImplementation(() => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createBaseline({ learnerId: LEARNER_ID, tenantId: TENANT_ID });
    expect(result).not.toBeNull();
    expect(result!.baseline.generationMetadata).toMatchObject({
      source: "fallback",
      fallbackReason: "timeout",
    });
    expect(result!.questions.length).toBeGreaterThan(0);
  });

  it("falls back to BANK on schema-invalid JSON", async () => {
    vi.stubEnv("AIVO_FEATURE_BASELINE_LLM", "true");
    primeSubmittedParentAssessment();

    const bad = makeValidLlmResponse(14);
    bad.questions[0]!.correctAnswer = "not-in-options";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      async json() {
        return bad;
      },
      async text() {
        return "";
      },
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createBaseline({ learnerId: LEARNER_ID, tenantId: TENANT_ID });
    expect(result).not.toBeNull();
    expect(result!.baseline.generationMetadata).toMatchObject({
      source: "fallback",
      fallbackReason: "schema_validation_failed",
    });
  });

  it("falls back to BANK with reason=no_submitted_parent_assessment when no assessment exists", async () => {
    vi.stubEnv("AIVO_FEATURE_BASELINE_LLM", "true");
    // Intentionally skip primeSubmittedParentAssessment() — the seeded
    // assessment has submittedAt=null.

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await createBaseline({ learnerId: LEARNER_ID, tenantId: TENANT_ID });
    expect(result).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result!.baseline.generationMetadata).toMatchObject({
      source: "fallback",
      fallbackReason: "no_submitted_parent_assessment",
    });
  });
});
