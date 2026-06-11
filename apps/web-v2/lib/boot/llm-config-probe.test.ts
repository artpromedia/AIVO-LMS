/**
 * Wave A (G2) — unit tests for the boot-time LLM config probe.
 *
 * Policy under test: missing credential = fatal, auth-shaped rejection
 * (401/403, plus 400 for Google) = fatal, network unreachability = warning
 * only, valid-token-but-bad-body (400 from assessment-svc) = pass, and the
 * boot assertion is a no-op outside the production runtime.
 */
import { describe, expect, it, vi } from "vitest";
import {
  assertLlmConfigAtBoot,
  probeLlmConfig,
  type LlmConfigProbeEnv,
} from "@/lib/boot/llm-config-probe";

function makeEnv(overrides: Partial<LlmConfigProbeEnv> = {}): LlmConfigProbeEnv {
  return {
    aiProvider: "anthropic",
    anthropicApiKey: "sk-ant-test",
    assessmentSvcUrl: "http://assessment-svc.test:3071",
    assessmentSvcServiceToken: "svc-token",
    baselineLlmEnabled: true,
    ...overrides,
  };
}

/** fetch stub that answers per-URL with a status, or throws. */
function fetchByUrl(routes: Record<string, number | Error>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.entries(routes).find(([prefix]) => url.startsWith(prefix));
    if (!match) throw new Error(`unrouted probe url: ${url}`);
    const result = match[1];
    if (result instanceof Error) throw result;
    return new Response("{}", { status: result });
  }) as typeof fetch;
}

describe("probeLlmConfig", () => {
  it("passes when the provider key is accepted and assessment-svc returns 400 (valid token, empty body)", async () => {
    const result = await probeLlmConfig({
      env: makeEnv(),
      fetchImpl: fetchByUrl({
        "https://api.anthropic.com": 200,
        "http://assessment-svc.test:3071": 400,
      }),
    });
    expect(result.fatal).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("is fatal when assessment-svc rejects the service token with 401", async () => {
    const result = await probeLlmConfig({
      env: makeEnv(),
      fetchImpl: fetchByUrl({
        "https://api.anthropic.com": 200,
        "http://assessment-svc.test:3071": 401,
      }),
    });
    expect(result.fatal).toHaveLength(1);
    expect(result.fatal[0]).toContain("ASSESSMENT_SVC_SERVICE_TOKEN");
    expect(result.fatal[0]).toContain("401");
  });

  it("is fatal when the baseline LLM flag is on but the service token is absent", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await probeLlmConfig({
      env: makeEnv({ assessmentSvcServiceToken: undefined, aiProvider: "mock" }),
      fetchImpl,
    });
    expect(result.fatal).toHaveLength(1);
    expect(result.fatal[0]).toContain("ASSESSMENT_SVC_SERVICE_TOKEN is not set");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is fatal when the Anthropic key is missing or rejected", async () => {
    const missing = await probeLlmConfig({
      env: makeEnv({ anthropicApiKey: undefined, baselineLlmEnabled: false }),
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(missing.fatal[0]).toContain("ANTHROPIC_API_KEY is not set");

    const rejected = await probeLlmConfig({
      env: makeEnv({ baselineLlmEnabled: false }),
      fetchImpl: fetchByUrl({ "https://api.anthropic.com": 401 }),
    });
    expect(rejected.fatal[0]).toContain("rejected");
    expect(rejected.fatal[0]).toContain("401");
  });

  it("treats network unreachability as a warning, never fatal", async () => {
    const result = await probeLlmConfig({
      env: makeEnv(),
      fetchImpl: fetchByUrl({
        "https://api.anthropic.com": new Error("getaddrinfo ENOTFOUND"),
        "http://assessment-svc.test:3071": new Error("connect ECONNREFUSED"),
      }),
    });
    expect(result.fatal).toEqual([]);
    expect(result.warnings).toHaveLength(2);
  });

  it("collects every fatal problem in one pass (openai + token both broken)", async () => {
    const result = await probeLlmConfig({
      env: makeEnv({
        aiProvider: "openai",
        openaiApiKey: "sk-bad",
        assessmentSvcServiceToken: undefined,
      }),
      fetchImpl: fetchByUrl({ "https://api.openai.com": 401 }),
    });
    expect(result.fatal).toHaveLength(2);
  });
});

describe("assertLlmConfigAtBoot", () => {
  it("is a no-op outside the production runtime (no fetch, no throw)", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      assertLlmConfigAtBoot({ env: makeEnv({ anthropicApiKey: undefined }), fetchImpl }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws on fatal config when the prod gate is forced", async () => {
    await expect(
      assertLlmConfigAtBoot({
        forceProd: true,
        env: makeEnv(),
        fetchImpl: fetchByUrl({
          "https://api.anthropic.com": 200,
          "http://assessment-svc.test:3071": 401,
        }),
      }),
    ).rejects.toThrow(/refusing to start/);
  });

  it("resolves when probes pass with warnings only", async () => {
    await expect(
      assertLlmConfigAtBoot({
        forceProd: true,
        env: makeEnv(),
        fetchImpl: fetchByUrl({
          "https://api.anthropic.com": 200,
          "http://assessment-svc.test:3071": new Error("ECONNREFUSED"),
        }),
      }),
    ).resolves.toBeUndefined();
  });
});
