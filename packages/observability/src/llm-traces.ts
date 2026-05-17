import { redactForLogging } from "./safe-logger.js";

export interface LlmTrace {
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  cached?: boolean;
  /**
   * Outcome summary suitable for analytics. Should NOT include raw learner
   * input, raw model output, OCR text, or any other sensitive free-form
   * content. Callers pass through `redactForLogging` automatically.
   */
  outcome: Record<string, unknown>;
  occurredAt: string;
  correlationId?: string;
}

export interface BuildLlmTraceInput {
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  cached?: boolean;
  outcome?: Record<string, unknown>;
  correlationId?: string;
}

export function buildLlmTrace(input: BuildLlmTraceInput): LlmTrace {
  return {
    model: input.model,
    provider: input.provider,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    latencyMs: input.latencyMs,
    cached: input.cached,
    outcome: redactForLogging(input.outcome ?? {}),
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
  };
}
