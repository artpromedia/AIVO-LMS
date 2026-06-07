import { test, expect } from "@playwright/test";

/**
 * Sprint 8 E2E — term-scoped syllabus journey (G7/G8, promise #4).
 *
 * A whole-term upload parses into per-week units (no 32KB truncation), and
 * an off-curriculum topic is flagged by jurisdiction validation.
 *
 * Hits ai-svc /parse-term and curriculum-svc /validate. Skips without URLs.
 */
const AI_SVC_URL = process.env.AI_SVC_URL;
const CURRICULUM_SVC_URL = process.env.CURRICULUM_SVC_URL;
const AI_TOKEN = process.env.INTERNAL_AI_TOKEN ?? "dev-tutor-svc-internal";
const SVC_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token";

function twelveWeekDoc(): string {
  const weeks = Array.from({ length: 12 }, (_, i) =>
    `Week ${i + 1}: Topic ${i + 1}\n  Students will master topic ${i + 1}.\nStandards: 3.NBT.A.${(i % 3) + 1}\n`,
  );
  return `Grade 3 Mathematics — Fall Term\n\n${weeks.join("\n")}`;
}

test.describe("term syllabus journey", () => {
  test.skip(!AI_SVC_URL || !CURRICULUM_SVC_URL, "Requires AI_SVC_URL and CURRICULUM_SVC_URL");

  test("a 12-week term parses into 12 units", async ({ request }) => {
    const res = await request.post(`${AI_SVC_URL}/api/ai/curriculum/parse-term`, {
      headers: { "X-Internal-Auth": AI_TOKEN, "content-type": "application/json" },
      data: { text: twelveWeekDoc(), subject: "math", term_count: 1, use_llm: false },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.unit_count).toBe(12);
  });

  test("an off-curriculum topic is flagged for review", async ({ request }) => {
    const res = await request.post(`${CURRICULUM_SVC_URL}/api/curriculum/validate`, {
      headers: { "X-Service-Token": SVC_TOKEN, "content-type": "application/json" },
      data: {
        country: "NG",
        region: "Lagos",
        subject: "math",
        gradeBand: "Primary-3",
        topics: ["Whole numbers up to 999", "Photosynthesis"],
        standards: ["3.NF.A.1"],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.offCurriculumCount).toBeGreaterThanOrEqual(2);
    expect(body.matched.map((m: { skillId: string }) => m.skillId)).toContain(
      "ng-nerdc.math.p3.number.whole-numbers",
    );
  });
});
