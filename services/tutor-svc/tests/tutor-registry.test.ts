import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TUTORS } from "@aivo/brand";
import { validateTutorDefinition } from "@aivo/tutor-sdk";
import { TUTOR_REGISTRY, getTutorDefinition, listTutorDefinitions } from "../src/modes/registry.js";

describe("tutor-svc tutor registry", () => {
  it("declares one TutorDefinition for every catalog tutor key", () => {
    const catalogKeys = Object.keys(TUTORS).sort();
    const registryKeys = Object.keys(TUTOR_REGISTRY).sort();
    assert.deepEqual(registryKeys, catalogKeys);
  });

  it("each TutorDefinition is well-formed per the SDK validator", () => {
    for (const [key, def] of listTutorDefinitions()) {
      const issues = validateTutorDefinition(def);
      assert.equal(issues.length, 0, `tutor "${key}" has issues: ${JSON.stringify(issues)}`);
    }
  });

  it("each TutorDefinition wires an ai-svc persona key", () => {
    for (const [key, def] of listTutorDefinitions()) {
      const personaKey = def.authoringMeta?.aiSvcPersonaKey;
      assert.ok(
        personaKey && personaKey.startsWith("ADDON_TUTOR_"),
        `tutor "${key}" missing aiSvcPersonaKey (got ${String(personaKey)})`,
      );
    }
  });

  it("each persona id matches the catalog key (UI ↔ runtime alignment)", () => {
    for (const [key, def] of listTutorDefinitions()) {
      assert.equal(
        def.persona.id,
        key,
        `tutor "${key}" persona id is "${def.persona.id}" (must match catalog key)`,
      );
    }
  });

  it("each TutorDefinition declares at least one skill-graph ref", () => {
    for (const [key, def] of listTutorDefinitions()) {
      assert.ok(def.skillGraphRefs.length > 0, `tutor "${key}" has no skillGraphRefs`);
    }
  });

  it("each tutor supports agentic guidance across PRE-K-12", () => {
    const k12 = ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
    for (const [key, def] of listTutorDefinitions()) {
      assert.ok(
        def.capabilities.includes("agentic_guidance"),
        `tutor "${key}" must declare agentic_guidance`,
      );
      for (const band of k12) {
        assert.ok(def.gradeBands.includes(band as any), `tutor "${key}" must include grade ${band}`);
      }
    }
  });

  it("each TutorDefinition declares a coverageMatrix covering every gradeBand", () => {
    for (const [key, def] of listTutorDefinitions()) {
      assert.ok(
        def.coverageMatrix,
        `tutor "${key}" missing coverageMatrix — see docs/quality/tutor-k12-coverage-gap-plan.md`,
      );
      for (const band of def.gradeBands) {
        const status = def.coverageMatrix[band];
        assert.ok(
          status === "authored" || status === "scaffold" || status === "missing",
          `tutor "${key}" gradeBand "${band}" has no coverageMatrix entry`,
        );
      }
    }
  });

  it("getTutorDefinition returns undefined for unknown keys", () => {
    assert.equal(getTutorDefinition("not-a-tutor"), undefined);
  });

  it("getTutorDefinition resolves every catalog key", () => {
    for (const key of Object.keys(TUTORS)) {
      assert.ok(getTutorDefinition(key), `missing tutor "${key}"`);
    }
  });
});
