/**
 * Remediation Sprint 02 — the REAL lesson path emits + persists a validated
 * domain surface.
 *
 * This drives the production `createLessonRun` (deterministic MockTutorProvider
 * in tests) against the seeded demo learner: generator → strict-schema
 * validation → persistence. It is the integration counterpart to the
 * generator unit test — it proves the `surface` envelope survives the exact
 * GeneratedLessonPlanSchema.parse + store round-trip the lesson player reads
 * back, and that the math-vs-reading contract holds on the real path.
 *
 * (The Playwright spec `e2e/lesson-player-math.playwright.ts` then asserts the
 * surface actually mounts in the browser; this test guarantees the data the
 * player receives is correct without standing up a dev server.)
 */
import { beforeAll, describe, expect, it } from "vitest";

const SKY = "lrn_demo_sky";
const TENANT = "t_demo";

beforeAll(() => {
  process.env.AIVO_SEED_DEMO_JOURNEY = "1";
});

describe("createLessonRun domain-surface emission (real path)", () => {
  it(
    "persists a schema-valid number_line surface on a math lesson",
    { timeout: 30_000 },
    async () => {
      const { ensureSeeded } = await import("@/lib/db/seed");
      const { createLessonRun } = await import("@/lib/db/repos");
      const { getPersistence } = await import("@/lib/db/persistence");
      const { LessonSurfaceSchema } = await import("@/lib/validators/lesson");
      ensureSeeded();

      const curriculum = getPersistence().curriculum;
      const subjects = await curriculum.listSubjects();
      const math = subjects.find((s) => s.slug === "math");
      expect(math, "demo seed must include a math subject").toBeTruthy();
      const mathSkills = await curriculum.listSkills(math!.id);
      expect(mathSkills.length).toBeGreaterThan(0);
      const skill = mathSkills[0];

      // Force the starter tier so the generator emits the early-numeracy
      // items (2+3 etc.) that derive a number line — deterministic regardless
      // of the seed's mastery for this skill.
      await curriculum.upsertSkillMastery({
        learnerId: SKY,
        skillId: skill.id,
        subjectId: math!.id,
        tenantId: TENANT,
        confidence: 0.5,
        level: "emerging",
        score: 0.2,
        needsReview: false,
        lastEvaluatedAt: new Date().toISOString(),
      });

      const result = await createLessonRun({
        learnerId: SKY,
        tenantId: TENANT,
        subjectId: math!.id,
        skillId: skill.id,
        source: "subject_path",
      });
      expect(result.ok, result.ok ? "" : `createLessonRun failed: ${(result as { message?: string }).message}`).toBe(true);
      if (!result.ok) return;

      // The persisted plan is what the lesson player reads back.
      const stored = await getPersistence().lessonRuns.getPlanById(
        result.lessonRun.lessonPlanId!,
        TENANT,
      );
      expect(stored, "generated plan must be persisted").toBeTruthy();

      // createLessonRun already runs GeneratedLessonPlanSchema.parse before
      // persisting (a malformed plan would have failed the run), so the
      // surface arrived through that gate. Assert it round-tripped intact and
      // re-validates against the surface schema the player trusts.
      const numberLineItems = stored!.guidedPractice.filter(
        (g) => g.surface?.surfaceType === "number_line",
      );
      expect(
        numberLineItems.length,
        "a starter-tier math lesson must emit at least one number_line surface",
      ).toBeGreaterThan(0);
      for (const item of numberLineItems) {
        expect(LessonSurfaceSchema.safeParse(item.surface).success).toBe(true);
        const spec = item.surface!.numberLine!;
        const answer = Number(item.expectedAnswer);
        expect(answer).toBeGreaterThanOrEqual(spec.min);
        expect(answer).toBeLessThanOrEqual(spec.max);
      }
    },
  );

  it(
    "K-band lessons serve AUTHORED pack content and stamp contentSource (Sprint 05)",
    { timeout: 30_000 },
    async () => {
      const { ensureSeeded } = await import("@/lib/db/seed");
      const { createLessonRun } = await import("@/lib/db/repos");
      const { getPersistence } = await import("@/lib/db/persistence");
      const { expandGradeBand } = await import("@/lib/learner/authored-content");
      ensureSeeded();

      const curriculum = getPersistence().curriculum;
      const math = (await curriculum.listSubjects()).find((s) => s.slug === "math")!;
      const kSkill = (await curriculum.listSkills(math.id)).find((s) =>
        expandGradeBand(s.gradeBand).has("K"),
      );
      expect(kSkill, "seed must include a K-band math skill").toBeTruthy();

      const result = await createLessonRun({
        learnerId: SKY,
        tenantId: TENANT,
        subjectId: math.id,
        skillId: kSkill!.id,
        source: "subject_path",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const stored = await getPersistence().lessonRuns.getPlanById(
        result.lessonRun.lessonPlanId!,
        TENANT,
      );
      // The plan's practice items are the REAL math-k-fall-2026 activities —
      // authoring a pack now changes what the learner sees — and the
      // provenance is stamped on the generation telemetry.
      expect(stored!.generation.contentSource).toBe("authored_pack");
      expect(stored!.guidedPractice.some((g) => g.prompt.includes("How many apples"))).toBe(true);

      // A subject with only the recognised template stub stays "template".
      const music = (await curriculum.listSubjects()).find((s) => s.slug === "music");
      if (music) {
        const musicSkill = (await curriculum.listSkills(music.id))[0];
        const musicRun = await createLessonRun({
          learnerId: SKY,
          tenantId: TENANT,
          subjectId: music.id,
          skillId: musicSkill.id,
          source: "subject_path",
        });
        expect(musicRun.ok).toBe(true);
        if (musicRun.ok) {
          const musicPlan = await getPersistence().lessonRuns.getPlanById(
            musicRun.lessonRun.lessonPlanId!,
            TENANT,
          );
          expect(musicPlan!.generation.contentSource).toBe("template");
        }
      }
    },
  );

  it(
    "reading lessons carry the READING surface, never math's number line",
    { timeout: 30_000 },
    async () => {
      const { ensureSeeded } = await import("@/lib/db/seed");
      const { createLessonRun } = await import("@/lib/db/repos");
      const { getPersistence } = await import("@/lib/db/persistence");
      ensureSeeded();

      const curriculum = getPersistence().curriculum;
      const reading = (await curriculum.listSubjects()).find((s) => s.slug === "reading");
      if (!reading) return; // seed without a reading subject — nothing to assert
      const skills = await curriculum.listSkills(reading.id);
      expect(skills.length).toBeGreaterThan(0);

      const result = await createLessonRun({
        learnerId: SKY,
        tenantId: TENANT,
        subjectId: reading.id,
        skillId: skills[0].id,
        source: "subject_path",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const stored = await getPersistence().lessonRuns.getPlanById(
        result.lessonRun.lessonPlanId!,
        TENANT,
      );
      // Sprint 03: reading rides its own domain surface — and never math's.
      const types = [...stored!.guidedPractice, ...stored!.checksForUnderstanding]
        .map((item) => item.surface?.surfaceType)
        .filter(Boolean);
      expect(types).toContain("reading_annotation");
      expect(types).not.toContain("number_line");
    },
  );
});
