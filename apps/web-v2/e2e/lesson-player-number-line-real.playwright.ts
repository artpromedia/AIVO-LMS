import { expect, test } from "@playwright/test";
import { findSurfaceInRealLesson, setLearnerSession } from "./lesson-player-surfaces.helpers";

/**
 * Remediation Sprint 02 — the number-line surface reaches a learner through
 * the REAL lesson path (createLessonRun → deterministic generator → strict
 * schema → player), not just the dev fixture, AND the math-vs-reading
 * contract holds: math renders a number line; reading does not.
 *
 * The smoke route generates a real lesson for the seeded demo learner; the
 * demo seed (AIVO_SEED_DEMO_JOURNEY=1, the dev-server default) gives early
 * math skills, so a starter/core math lesson emits an early-numeracy item
 * whose answer space derives a number line.
 */
test("number-line surface mounts in a real math lesson, not in reading", async ({
  context,
  page,
}) => {
  await setLearnerSession(context);

  const mathHasNumberLine = await findSurfaceInRealLesson(page, "math", "number-line-surface");
  expect(mathHasNumberLine, "a real math lesson must mount the number-line surface").toBe(true);

  // Same learner, reading subject: the generic surface, never a number line
  // (Sprint 02 wires nova/math only).
  const readingHasNumberLine = await findSurfaceInRealLesson(
    page,
    "reading",
    "number-line-surface",
  );
  expect(readingHasNumberLine, "reading must not share the math number-line surface").toBe(false);
});
