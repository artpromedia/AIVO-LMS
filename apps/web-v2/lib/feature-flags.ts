/**
 * Lightweight feature flag accessors for runtime gating.
 *
 * Flags are read from environment variables (with `NEXT_PUBLIC_` prefix
 * for those the browser needs). The helpers below normalise truthy
 * strings ("1", "true", "yes", "on") so flag toggling works the same
 * way from a `.env.local` file, a CI secret, or a Vercel project
 * setting.
 *
 * Defaults are intentionally biased toward safety:
 *
 *   - `LEARNER_LESSON_PLAYER_V2`: defaults OFF in production, ON in
 *     preview/dev. Sprint 1 (Gap #3) — route the lesson player
 *     through the real `/sessions` + `/path` APIs.
 *   - `SUBJECT_CONTENT_READY`: defaults OFF until item-bank authoring
 *     completes. Sprint 2 (Gap #7) — gates the "Coming soon" badge
 *     on newly seeded subjects.
 */

type Truthy = "1" | "true" | "yes" | "on" | "y";

function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "on", "y"].includes(v.trim().toLowerCase() as Truthy);
}

function isExplicitlyFalsy(v: string | undefined): boolean {
  if (!v) return false;
  return ["0", "false", "no", "off", "n"].includes(v.trim().toLowerCase());
}

/**
 * Public flag readable on the browser. Mirrored at build time via
 * `NEXT_PUBLIC_LEARNER_LESSON_PLAYER_V2` so server and client agree on
 * the active variant.
 */
export function lessonPlayerV2Enabled(): boolean {
  const fromPublic = process.env.NEXT_PUBLIC_LEARNER_LESSON_PLAYER_V2;
  const fromServer = process.env.LEARNER_LESSON_PLAYER_V2;
  // Explicit values win.
  if (isTruthy(fromPublic) || isTruthy(fromServer)) return true;
  if (isExplicitlyFalsy(fromPublic) || isExplicitlyFalsy(fromServer)) return false;

  // Default: on in preview/dev, off in production.
  const env = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === "preview") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

/**
 * `SUBJECT_CONTENT_READY` controls whether newly seeded subjects
 * (Sprint 2.1) ship with a "Coming soon" badge. When item-bank
 * authoring catches up the badge is dropped by flipping this flag.
 */
export function subjectContentReadyEnabled(): boolean {
  const fromPublic = process.env.NEXT_PUBLIC_SUBJECT_CONTENT_READY;
  const fromServer = process.env.SUBJECT_CONTENT_READY;
  if (isTruthy(fromPublic) || isTruthy(fromServer)) return true;
  // Default: not ready — show the badge for placeholder subjects.
  return false;
}

/**
 * Subjects that were added to the seed in Sprint 2.1 but don't yet
 * have a full item bank. The badge logic should consult both
 * `subjectContentReadyEnabled()` and this list.
 *
 * Sprint 5.3 shipped the social-studies brain + 30 fixture items, so
 * "social-studies" is no longer in this set. world-languages and coding
 * remain until their content ramps land.
 */
export const COMING_SOON_SUBJECT_SLUGS = new Set([
  "world-languages",
  "coding",
]);

export function isSubjectComingSoon(slug: string): boolean {
  if (subjectContentReadyEnabled()) return false;
  return COMING_SOON_SUBJECT_SLUGS.has(slug);
}

/**
 * Sprint B2 (Baseline Assessment must use LLMs).
 *
 * `AIVO_FEATURE_BASELINE_LLM` gates `createBaseline` calling the
 * assessment-svc `/api/ai/generate-baseline` path. When OFF (or on any
 * failure) the deterministic BANK in `lib/learner/baseline.ts` is used
 * instead, so the flag is a true kill switch — flipping it OFF cannot
 * break baseline creation.
 *
 * Defaults: ON in dev/preview/test (so contributors exercise the LLM
 * code path), OFF in production until the staging soak in Sprint B6
 * promotes it.
 */
export function baselineLlmEnabled(): boolean {
  const fromServer = process.env.AIVO_FEATURE_BASELINE_LLM;
  if (isTruthy(fromServer)) return true;
  if (isExplicitlyFalsy(fromServer)) return false;
  const env = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === "preview") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}
