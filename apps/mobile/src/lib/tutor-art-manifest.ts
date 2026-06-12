/**
 * Pure manifest of bundled tutor art — testable without Metro's asset
 * pipeline. `tutor-art.ts` mirrors this with static require() calls (Metro
 * needs literals); the lockstep test asserts the two never drift and that
 * the manifest covers the TUTORS catalogue exactly.
 */
export const TUTOR_ART_FILES = {
  nova: "nova.png",
  sage: "sage.png",
  spark: "spark.png",
  chrono: "chrono.png",
  pixel: "pixel.png",
  echo: "echo.png",
  harmony: "harmony.png",
  atlas: "atlas.png",
  cadence: "cadence.png",
  compass: "compass.png",
  forge: "forge.png",
  lingua: "lingua.png",
  muse: "muse.png",
  vigor: "vigor.png",
} as const;

export type TutorArtSlug = keyof typeof TUTOR_ART_FILES;
