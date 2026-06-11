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
 * Defaults: ON everywhere, including production. The baseline must be
 * LLM-personalized from the parent (and, when present, caregiver +
 * teacher) assessments rather than serving the static BANK. Any failure
 * — flag explicitly OFF, auth rejection, timeout, too-few questions, or
 * no subject mapping — still falls open to the deterministic BANK, so
 * ON-by-default cannot break baseline creation; it only upgrades the
 * default experience. Set `AIVO_FEATURE_BASELINE_LLM=false` to use the
 * BANK as a kill switch.
 */
export function baselineLlmEnabled(): boolean {
  const fromServer = process.env.AIVO_FEATURE_BASELINE_LLM;
  if (isExplicitlyFalsy(fromServer)) return false;
  return true;
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
 * Pre-generated baseline bank — serve a baseline by SELECTING from the
 * offline-generated question bank (see lib/learner/baseline-bank.ts) instead
 * of calling the LLM on the request path. This is the instant, non-blocking
 * top tier of the baseline ladder: it turns a ~130s synchronous LLM render
 * (which timed out at the ingress and showed parents an error page) into a
 * sub-millisecond in-memory pick, while keeping LLM-quality questions matched
 * to the learner's grade band + functioning level.
 *
 * Defaults: ON everywhere. It is fail-open — when the bank lacks coverage for
 * a learner's cell the selector returns nothing and `createBaseline` falls
 * through to the live LLM / deterministic BANK ladder, so flipping it OFF
 * (`AIVO_FEATURE_BASELINE_BANK=false`) only changes the source, never breaks
 * baseline creation.
 */
export function baselineBankEnabled(): boolean {
  const fromServer = process.env.AIVO_FEATURE_BASELINE_BANK;
  if (isExplicitlyFalsy(fromServer)) return false;
  return true;
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
 * Sprint 5 (un-gate the visual brain build).
 *
 * When ON, a completed baseline that has not produced a `cloned` brain
 * profile routes the parent to an actionable `brain_build_pending` surface
 * (with a rebuild action) instead of silently skipping the visual build and
 * dropping them at `ready_for_today_mission`. When OFF, the prior
 * fall-through behaviour is preserved, so the flag is a reversible kill
 * switch for the routing change.
 *
 * Default OFF in production until QA; ON in dev/preview/test.
 */
export function visualBrainBuildEnabled(): boolean {
  const fromServer = process.env.AIVO_FLAG_VISUAL_BRAIN_BUILD;
  if (isTruthy(fromServer)) return true;
  if (isExplicitlyFalsy(fromServer)) return false;
  const env = process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === "preview") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

/**
 * Delegated-admin RBAC v2 rollout flag — tenant-scoped since Sprint B2:
 * resolved through getTenantFlags() (kill switch > district override >
 * env default), so a single district can pilot delegated-admin
 * capabilities. Platform-staff sessions are tenant-less and read the
 * environment default layer.
 */
export async function delegatedAdminRbacV2Enabled(): Promise<boolean> {
  const { getTenantFlags } = await import("@/lib/bff/tenant-flags");
  const flags = await getTenantFlags();
  return flags.delegatedAdminRbacV2;
}
