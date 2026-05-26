/**
 * Sprint 14 (C) — first-class metric counters for AI safety + cost.
 *
 * These wrap the generic `createCounter()` registry in `./index.ts` so
 * callers across services emit consistent label sets. Importing this
 * module registers the counters at process start; calling the
 * `record*()` helpers increments them.
 *
 * The counter names match the Prometheus exposition exactly so the
 * existing /metrics scrape (see `exportMetrics`) picks them up with no
 * extra config.
 */
import { createCounter, type Counter } from "./index.js";

// ── LLM cost + cache --------------------------------------------------------

const llmTokenCostCounter: Counter = createCounter(
  "llm_token_cost_cents_total",
  ["tenant_id", "model", "op"],
);

const promptCacheHitCounter: Counter = createCounter(
  "prompt_cache_hit_total",
  ["tenant_id", "model"],
);

const promptCacheRequestCounter: Counter = createCounter(
  "prompt_cache_request_total",
  ["tenant_id", "model"],
);

// ── Responsible AI ----------------------------------------------------------

const responsibleAiBlockCounter: Counter = createCounter(
  "responsible_ai_block_total",
  ["detector", "verdict"],
);

const responsibleAiEvaluationCounter: Counter = createCounter(
  "responsible_ai_evaluation_total",
  ["verdict"],
);

const crisisEscalationCounter: Counter = createCounter(
  "crisis_escalation_total",
  ["tenant_id"],
);

const tenantLlmCapExceededCounter: Counter = createCounter(
  "tenant_llm_cap_exceeded_total",
  ["tenant_id"],
);

// ── Recording helpers -------------------------------------------------------

export interface LlmCostEvent {
  tenantId: string;
  model: string;
  op: string; // 'completion' | 'embedding' | 'moderation' | …
  costCents: number;
}

export function recordLlmCost(ev: LlmCostEvent): void {
  llmTokenCostCounter.increment(Math.max(0, Math.round(ev.costCents)), {
    tenant_id: ev.tenantId || "unknown",
    model: ev.model,
    op: ev.op,
  });
}

export interface PromptCacheEvent {
  tenantId: string;
  model: string;
  hit: boolean;
}

export function recordPromptCacheLookup(ev: PromptCacheEvent): void {
  const labels = { tenant_id: ev.tenantId || "unknown", model: ev.model };
  promptCacheRequestCounter.increment(1, labels);
  if (ev.hit) promptCacheHitCounter.increment(1, labels);
}

export type ResponsibleAiVerdict = "allow" | "block" | "review";

export function recordResponsibleAiBlock(
  detector: string,
  verdict: ResponsibleAiVerdict,
): void {
  responsibleAiBlockCounter.increment(1, { detector, verdict });
}

export function recordResponsibleAiEvaluation(
  verdict: ResponsibleAiVerdict,
): void {
  responsibleAiEvaluationCounter.increment(1, { verdict });
}

export function recordCrisisEscalation(tenantId: string): void {
  crisisEscalationCounter.increment(1, {
    tenant_id: tenantId || "unknown",
  });
}

export function recordTenantLlmCapExceeded(tenantId: string): void {
  tenantLlmCapExceededCounter.increment(1, {
    tenant_id: tenantId || "unknown",
  });
}
