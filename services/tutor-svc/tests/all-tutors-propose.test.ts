/**
 * P5 — "the brain proposes" must be true for EVERY tutor, not just math/ELA.
 *
 * Each registered tutor must declare the bounded write tools (file_evidence +
 * propose_recommendation) so any subject can file an evidence-cited, parent-approved
 * recommendation through the same policy + approve/amend/deny pipeline. The per-session
 * rate limit, dedup, type policy and approval gate live in recommendation-svc and are
 * unchanged — a tutor can only PROPOSE, never self-apply.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { listTutorDefinitions } from "../src/modes/registry.js";
import { WRITE_TOOLS } from "../src/agent/orchestrator.js";

describe("P5 — every tutor can propose like math/ELA", () => {
  it("all registered tutors declare file_evidence + propose_recommendation", () => {
    const missing: string[] = [];
    for (const [key, def] of listTutorDefinitions()) {
      if (!def.toolset.includes("propose_recommendation")) missing.push(`${key}:propose_recommendation`);
      if (!def.toolset.includes("file_evidence")) missing.push(`${key}:file_evidence`);
    }
    assert.deepEqual(missing, [], `tutors missing proposal tools: ${missing.join(", ")}`);
  });

  it("the declared write tools are the executable WRITE_TOOLS set", () => {
    for (const [, def] of listTutorDefinitions()) {
      for (const tool of def.toolset) {
        if (tool === "file_evidence" || tool === "propose_recommendation") {
          assert.ok(WRITE_TOOLS.has(tool), `${tool} must be an executable write tool`);
        }
      }
    }
  });
});
