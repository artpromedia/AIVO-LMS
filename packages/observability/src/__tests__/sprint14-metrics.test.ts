/**
 * Sprint 14 (C) — assertions for the named AI-safety + cost counters.
 *
 * The counters are registered on import (side effect of metrics.ts).
 * Tests verify the Prometheus exposition includes them with the right
 * label sets after the typed recorders run.
 *
 * Note: this suite intentionally does NOT call `_resetMetrics()`
 * beforehand because the metric registration in metrics.ts only runs
 * once per module-load. Instead, we read the deltas by snapshot
 * comparison.
 */
import { describe, it, expect } from "vitest";
import {
  exportMetrics,
  recordCrisisEscalation,
  recordLlmCost,
  recordPromptCacheLookup,
  recordResponsibleAiBlock,
  recordResponsibleAiEvaluation,
  recordTenantLlmCapExceeded,
} from "../index.js";

function snapshotCount(metric: string, labelSubstr: string): number {
  const out = exportMetrics();
  const matcher = new RegExp(`${metric}\\{[^}]*${labelSubstr}[^}]*\\} (\\d+)`);
  const m = out.match(matcher);
  return m ? Number(m[1]) : 0;
}

describe("sprint14 metric helpers", () => {
  it("records llm token cost with tenant/model/op", () => {
    const before = snapshotCount(
      "llm_token_cost_cents_total",
      'tenant_id="t-cost"',
    );
    recordLlmCost({
      tenantId: "t-cost",
      model: "rung-x",
      op: "completion",
      costCents: 12,
    });
    const after = snapshotCount(
      "llm_token_cost_cents_total",
      'tenant_id="t-cost"',
    );
    expect(after - before).toBe(12);
  });

  it("records prompt cache hit + request together", () => {
    const beforeReq = snapshotCount(
      "prompt_cache_request_total",
      'tenant_id="t-pc"',
    );
    const beforeHit = snapshotCount(
      "prompt_cache_hit_total",
      'tenant_id="t-pc"',
    );
    recordPromptCacheLookup({ tenantId: "t-pc", model: "rung-x", hit: true });
    recordPromptCacheLookup({ tenantId: "t-pc", model: "rung-x", hit: false });
    expect(
      snapshotCount("prompt_cache_request_total", 'tenant_id="t-pc"') -
        beforeReq,
    ).toBe(2);
    expect(
      snapshotCount("prompt_cache_hit_total", 'tenant_id="t-pc"') - beforeHit,
    ).toBe(1);
  });

  it("records responsible-ai block + evaluation counters", () => {
    const beforeBlock = snapshotCount(
      "responsible_ai_block_total",
      'detector="pii"',
    );
    const beforeEval = snapshotCount(
      "responsible_ai_evaluation_total",
      'verdict="block"',
    );
    recordResponsibleAiBlock("pii", "block");
    recordResponsibleAiEvaluation("block");
    expect(
      snapshotCount("responsible_ai_block_total", 'detector="pii"') -
        beforeBlock,
    ).toBe(1);
    expect(
      snapshotCount(
        "responsible_ai_evaluation_total",
        'verdict="block"',
      ) - beforeEval,
    ).toBe(1);
  });

  it("records crisis escalation and cap exceeded", () => {
    const beforeCrisis = snapshotCount(
      "crisis_escalation_total",
      'tenant_id="t-x"',
    );
    const beforeCap = snapshotCount(
      "tenant_llm_cap_exceeded_total",
      'tenant_id="t-x"',
    );
    recordCrisisEscalation("t-x");
    recordTenantLlmCapExceeded("t-x");
    expect(
      snapshotCount("crisis_escalation_total", 'tenant_id="t-x"') -
        beforeCrisis,
    ).toBe(1);
    expect(
      snapshotCount("tenant_llm_cap_exceeded_total", 'tenant_id="t-x"') -
        beforeCap,
    ).toBe(1);
  });
});
