/**
 * Layering guard for the Anthropic tutor provider.
 *
 * This test enforces the same invariant `scripts/lessonrun-audit.mjs`
 * polices at release-gate time: only `lib/ai/tutor.ts` (the
 * orchestrator) is allowed to reach `generateDeterministicLessonPlan`.
 * A real provider must NOT import the deterministic generator — it
 * receives a schema-valid `example` plan from the orchestrator and
 * anchors its output to that shape.
 *
 * If this test ever flips red, do not weaken it. Move the deterministic
 * fallback back into `generateLessonPlanWithRetry` and have the
 * provider consume `example`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const PROVIDER_PATH = path.resolve(__dirname, "..", "anthropic-tutor.ts");

describe("anthropic-tutor layering", () => {
  const src = readFileSync(PROVIDER_PATH, "utf8");

  it("does not import generateDeterministicLessonPlan", () => {
    // Catch both `import { generateDeterministicLessonPlan }` and
    // any `from ".../lesson-plan"` re-import that pulls it in.
    expect(/import[^;]*generateDeterministicLessonPlan/.test(src)).toBe(false);
    expect(/from\s+["']@\/lib\/learner\/lesson-plan["']/.test(src)).toBe(false);
    expect(/from\s+["']\.\.?\/[^"']*lesson-plan["']/.test(src)).toBe(false);
  });

  it("does not call generateDeterministicLessonPlan directly", () => {
    expect(/generateDeterministicLessonPlan\s*\(/.test(src)).toBe(false);
  });

  it("accepts and consumes the orchestrator-supplied `example` plan", () => {
    // The provider must keep the `(input, example)` signature so the
    // orchestrator's deterministic fallback can be passed as the
    // few-shot anchor.
    expect(/generate\s*\(\s*input\s*,\s*example\s*\)/.test(src)).toBe(true);
    // And it must actually use `example` in the prompt construction —
    // a parameter that's never read would defeat the purpose.
    expect(/buildUserPrompt\([^)]*example[^)]*\)/.test(src)).toBe(true);
  });
});
