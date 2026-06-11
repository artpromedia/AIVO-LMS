/**
 * Wave A (G2) — production boot probe for the AI personalization config.
 *
 * Both AI ladders in this app fail OPEN: a missing/rejected
 * ASSESSMENT_SVC_SERVICE_TOKEN silently downgrades baselines to the
 * offline bank, and a missing provider key silently downgrades every
 * lesson plan to the deterministic template. Fail-open is correct at
 * request time (a learner must never be blocked) — which is exactly why
 * the DEPLOY must fail closed: if the configuration can only ever
 * produce degraded content, refuse to start and say precisely why.
 *
 * Probe policy:
 *   - Missing credential → FATAL (the config is definitively broken).
 *   - Upstream 401/403 (auth-shaped rejection) → FATAL.
 *   - Network error / non-auth status → WARNING only. An upstream being
 *     briefly unreachable during a rolling deploy is not a misconfig,
 *     and boot must not deadlock on service start order.
 *
 * The assessment-svc probe POSTs an EMPTY body to the generate-baseline
 * route: with a valid service token the Fastify body schema rejects it
 * with 400 *before* the handler runs (so the probe is free — no LLM
 * call); with a bad/missing token the auth preHandler returns 401.
 * Distinguishing 400 from 401 verifies the token end-to-end.
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { baselineLlmEnabled } from "@/lib/feature-flags";

const PROBE_TIMEOUT_MS = 5_000;

export type LlmConfigProbeResult = {
  fatal: string[];
  warnings: string[];
};

export type LlmConfigProbeEnv = {
  aiProvider: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  assessmentSvcUrl: string;
  assessmentSvcServiceToken?: string;
  baselineLlmEnabled: boolean;
};

function envFromServer(): LlmConfigProbeEnv {
  return {
    aiProvider: serverEnv.AI_PROVIDER,
    anthropicApiKey: serverEnv.ANTHROPIC_API_KEY,
    openaiApiKey: serverEnv.OPENAI_API_KEY,
    googleApiKey: serverEnv.GOOGLE_API_KEY,
    assessmentSvcUrl: serverEnv.ASSESSMENT_SVC_URL,
    assessmentSvcServiceToken: serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN,
    baselineLlmEnabled: baselineLlmEnabled(),
  };
}

type ProbeFetch = typeof fetch;

async function probeStatus(
  fetchImpl: ProbeFetch,
  input: string,
  init: RequestInit,
): Promise<{ ok: true; status: number } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl(input, {
      ...init,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Run every configured probe and report. Pure with respect to its
 * inputs (env + fetch are injectable) so the policy is unit-testable.
 */
export async function probeLlmConfig(opts?: {
  env?: LlmConfigProbeEnv;
  fetchImpl?: ProbeFetch;
}): Promise<LlmConfigProbeResult> {
  const env = opts?.env ?? envFromServer();
  const fetchImpl = opts?.fetchImpl ?? globalThis.fetch;
  const fatal: string[] = [];
  const warnings: string[] = [];

  // ── 1. Lesson-plan provider key ────────────────────────────────────────
  if (env.aiProvider === "anthropic") {
    if (!env.anthropicApiKey) {
      fatal.push(
        "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set — every lesson " +
          "plan would silently use the deterministic template provider.",
      );
    } else {
      const r = await probeStatus(fetchImpl, "https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: { "x-api-key": env.anthropicApiKey, "anthropic-version": "2023-06-01" },
      });
      if (!r.ok) {
        warnings.push(`Anthropic key probe could not reach api.anthropic.com: ${r.error}`);
      } else if (r.status === 401 || r.status === 403) {
        fatal.push(
          `ANTHROPIC_API_KEY was rejected by api.anthropic.com (status ${r.status}) — ` +
            "lesson plans would silently degrade to the deterministic template.",
        );
      }
    }
  } else if (env.aiProvider === "openai") {
    if (!env.openaiApiKey) {
      fatal.push("AI_PROVIDER=openai but OPENAI_API_KEY is not set.");
    } else {
      const r = await probeStatus(fetchImpl, "https://api.openai.com/v1/models", {
        method: "GET",
        headers: { authorization: `Bearer ${env.openaiApiKey}` },
      });
      if (!r.ok) {
        warnings.push(`OpenAI key probe could not reach api.openai.com: ${r.error}`);
      } else if (r.status === 401 || r.status === 403) {
        fatal.push(`OPENAI_API_KEY was rejected by api.openai.com (status ${r.status}).`);
      }
    }
  } else if (env.aiProvider === "google") {
    if (!env.googleApiKey) {
      fatal.push("AI_PROVIDER=google but GOOGLE_API_KEY is not set.");
    } else {
      const r = await probeStatus(
        fetchImpl,
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.googleApiKey)}`,
        { method: "GET" },
      );
      if (!r.ok) {
        warnings.push(`Google key probe could not reach generativelanguage.googleapis.com: ${r.error}`);
      } else if (r.status === 400 || r.status === 401 || r.status === 403) {
        // Google returns 400 INVALID_ARGUMENT for a malformed/invalid key.
        fatal.push(`GOOGLE_API_KEY was rejected (status ${r.status}).`);
      }
    }
  }

  // ── 2. Baseline LLM path (assessment-svc service token) ───────────────
  if (env.baselineLlmEnabled) {
    if (!env.assessmentSvcServiceToken) {
      fatal.push(
        "AIVO_FEATURE_BASELINE_LLM is enabled but ASSESSMENT_SVC_SERVICE_TOKEN is " +
          "not set — assessment-svc would 401 every call and baselines would " +
          'silently fall back to the offline bank while still being labeled "AI".',
      );
    } else {
      const base = env.assessmentSvcUrl.replace(/\/+$/, "");
      const r = await probeStatus(fetchImpl, `${base}/api/ai/generate-baseline`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service": "web-v2-boot-probe",
          "x-service-token": env.assessmentSvcServiceToken,
        },
        // Empty body: the route's schema requires parent_assessment, so a
        // valid token yields 400 before any handler/LLM work happens.
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        warnings.push(
          `assessment-svc probe could not reach ${base} (${r.error}) — token presence ` +
            "verified, liveness not. If this persists after rollout, baselines are " +
            "running on the bank tier.",
        );
      } else if (r.status === 401 || r.status === 403) {
        fatal.push(
          `ASSESSMENT_SVC_SERVICE_TOKEN was rejected by assessment-svc (status ${r.status}) — ` +
            "baselines would silently fall back to the offline bank.",
        );
      }
    }
  }

  return { fatal, warnings };
}

/**
 * Boot entry point (called from instrumentation.ts). No-op outside the
 * production runtime: the `next build` compile phase, dev servers, and
 * AIVO_TEST_MODE stacks must not require network or real credentials.
 * Throws (failing startup) when any probe is fatal.
 */
export async function assertLlmConfigAtBoot(opts?: {
  env?: LlmConfigProbeEnv;
  fetchImpl?: ProbeFetch;
  /** Test seam — force the prod gate. */
  forceProd?: boolean;
}): Promise<void> {
  const isProdRuntime =
    process.env.NODE_ENV === "production" &&
    (process.env.NEXT_PHASE ?? "") !== "phase-production-build" &&
    process.env.AIVO_TEST_MODE !== "1";
  if (!opts?.forceProd && !isProdRuntime) return;

  const result = await probeLlmConfig(opts);
  for (const w of result.warnings) {
    logger.warn({ event: "boot.llm_config_probe_warning" }, `[llm-config-probe] ${w}`);
  }
  if (result.fatal.length > 0) {
    const message =
      "LLM configuration probe failed — refusing to start with silently-degraded " +
      `AI personalization:\n- ${result.fatal.join("\n- ")}`;
    logger.error({ event: "boot.llm_config_probe_fatal", fatal: result.fatal }, message);
    throw new Error(message);
  }
  logger.info(
    { event: "boot.llm_config_probe_ok", warnings: result.warnings.length },
    "[llm-config-probe] AI personalization config verified",
  );
}
