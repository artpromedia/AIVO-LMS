/**
 * Sprint 12.6 — smoke test for @aivo/curriculum-authoring.
 *
 * Exercises the schema-version constant + the K-8 pack validator. The
 * validator is the SME review gate that gates curriculum-svc loads,
 * so even a basic "rejects garbage / accepts the schema-version
 * marker" check is worth pinning here.
 */
import { describe, it, expect } from "vitest";
import { K8_CURRICULUM_SCHEMA_VERSION, validateK8CurriculumPack } from "../src/index";

describe("@aivo/curriculum-authoring smoke", () => {
  it("exposes a stable schema-version marker", () => {
    expect(typeof K8_CURRICULUM_SCHEMA_VERSION).toBe("string");
    expect(K8_CURRICULUM_SCHEMA_VERSION).toMatch(/k8-authoring/);
  });

  it("validateK8CurriculumPack rejects non-object input", () => {
    const res = validateK8CurriculumPack(null);
    expect(res.ok).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res.issues[0].code).toBe("schema_invalid");
  });

  it("validateK8CurriculumPack rejects an empty object as schema_invalid", () => {
    const res = validateK8CurriculumPack({});
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "schema_invalid")).toBe(true);
  });
});
