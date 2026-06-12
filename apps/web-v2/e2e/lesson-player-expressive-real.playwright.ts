import { expect, test } from "@playwright/test";
import { findSurfaceInRealLesson, setLearnerSession } from "./lesson-player-surfaces.helpers";

/**
 * Remediation Sprint 04 — the expressive domain surfaces reach a learner
 * through the REAL lesson path (createLessonRun → deterministic generator →
 * strict schema → player): coding writes code in the sandbox, music taps the
 * rhythm grid, art draws on the canvas, speech records into the mic surface.
 * No fixture defaults exist for any of these any more, so a mount proves the
 * validated `surface` envelope carried real content end to end.
 */
const CASES: Array<{ subject: string; label: string }> = [
  { subject: "coding", label: "coding-sandbox-surface" },
  { subject: "music", label: "music-sequencer-surface" },
  { subject: "art", label: "art-canvas-surface" },
  { subject: "speech", label: "voice-response-surface" },
];

for (const { subject, label } of CASES) {
  test(`${subject} lesson mounts the ${label}`, async ({ context, page }) => {
    await setLearnerSession(context);
    const found = await findSurfaceInRealLesson(page, subject, label);
    expect(found, `a real ${subject} lesson must mount ${label}`).toBe(true);
  });
}
