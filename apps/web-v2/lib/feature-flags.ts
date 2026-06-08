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
 *
 * Sprint 6 retired `SUBJECT_CONTENT_READY` and `isSubjectComingSoon`:
 * the learner UI now filters subjects through `getProductionReadySubjects()`
 * in `@aivo/brand`, so non-ready subjects are hidden entirely instead
 * of rendered with a "Coming soon" placeholder.
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

/**
 * Phase B — Discovery Adventure baseline. When ON, `createBaseline`
 * first attempts per-chapter generation via the assessment-svc
 * `/api/assessments/learner/discovery/:learnerId/chapter` route so
 * picture-prompt questions arrive with `sceneEmoji` + `choiceEmojis`
 * populated. Any failure falls through to the flat `/generate-baseline`
 * path (gated by `baselineLlmEnabled`) and finally to the deterministic
 * BANK. Independent kill switch so we can disable Discovery without
 * losing the LLM baseline path.
 */
export function baselineDiscoveryEnabled(): boolean {
  const fromServer = process.env.AIVO_FEATURE_BASELINE_DISCOVERY;
  if (isTruthy(fromServer)) return true;
  if (isExplicitlyFalsy(fromServer)) return false;
  // Default ON wherever the flat LLM baseline is on, so the emoji-rich
  // path is the steady-state behaviour and the flat path is the
  // graceful-degradation tier.
  return baselineLlmEnabled();
}

/**
 * Phase 0 — Adaptive baseline. When ON, two things change:
 *
 *   1. `createBaseline` widens the BANK-fallback pool
 *      (`generateAdaptiveBaselinePool`) so the selector has a real
 *      difficulty spread to move across instead of a fixed 2-level window.
 *   2. The baseline runner picks each *next* question from the
 *      `@aivo/adaptive-baseline` engine (`selectNextAdaptiveQuestion`),
 *      so item difficulty adapts to the learner's running accuracy and the
 *      run can stop early once the ability estimate is confident.
 *
 * When OFF (the production default until the parity soak), the baseline
 * behaves exactly as before: fixed-form generation + static next-question
 * order. This makes the flag a true, reversible kill switch.
 *
 * Defaults: ON in dev/preview/test so contributors exercise the adaptive
 * path; OFF in production.
 */
export function baselineAdaptiveEnabled(): boolean {
  const fromServer = process.env.AIVO_FEATURE_BASELINE_ADAPTIVE;
  if (isTruthy(fromServer)) return true;
  if (isExplicitlyFalsy(fromServer)) return false;
  const env = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === "preview") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

/**
 * Adaptive baseline *streaming* — drive the assessment-svc session run-loop
 * (`/api/assessments/adaptive-baseline/:learnerId/{start,respond,finalize}`)
 * so item selection + θ state live server-side and survive interruptions,
 * instead of adapting over a locally pre-generated pool (the
 * `baselineAdaptiveEnabled` path).
 *
 * Explicit opt-in (OFF everywhere until the runner cutover + a staging
 * soak): this gates an external, stateful service call per item, so it
 * should only flip on once the transport is proven in an environment.
 */
export function baselineStreamingEnabled(): boolean {
  return isTruthy(process.env.AIVO_FEATURE_BASELINE_STREAMING);
}

/**
 * Sprint 3 (parent-assessment → collaborator invites → brain build).
 *
 * Gates the "Invite your child's team" step in the parent onboarding
 * readiness flow. When ON, after the parent assessment is submitted the
 * parent is routed to a gated, skippable team-invite step
 * (`team_invite_optional`) before the IEP/baseline branch. When OFF, the
 * flow is exactly as before (assessment submit → IEP/baseline), so the
 * flag is a true reversible kill switch — no revert needed to roll back.
 *
 * Default OFF in production until QA; ON in dev/preview/test so the new
 * step is exercised by contributors.
 */
export function collaboratorInviteStepEnabled(): boolean {
  const fromServer = process.env.AIVO_FLAG_COLLAB_INVITE_STEP;
  if (isTruthy(fromServer)) return true;
  if (isExplicitlyFalsy(fromServer)) return false;
  const env = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === "preview") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

/**
 * Delegated-admin RBAC v2 rollout flag. Mirrors the server-side
 * `ADMIN_ENTERPRISE_DELEGATED_ADMIN_RBAC_V2` toggle so the admin shell can
 * dark-launch platform-staff and delegated-admin capabilities without
 * drifting from identity-svc.
 */
export function delegatedAdminRbacV2Enabled(): boolean {
  const fromServer = process.env.ADMIN_ENTERPRISE_DELEGATED_ADMIN_RBAC_V2;
  if (isTruthy(fromServer)) return true;
  if (isExplicitlyFalsy(fromServer)) return false;
  return false;
}
