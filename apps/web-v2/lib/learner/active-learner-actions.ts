"use server";

/**
 * Server Action: a parent "enters" a learner's experience.
 *
 * Sets the `aivo_active_learner_id` cookie for the chosen learner and lands the
 * parent on `/learner/home`.
 *
 * Why a Server Action and not a `<Link>` to the `/learner/select/auto` GET route
 * handler (the previous approach): cookies can only be mutated in a Server
 * Action or a Route Handler, but client-side `<Link>` navigation to that
 * cookie-setting route handler is unreliable —
 *
 *   1. The App Router prefetches `<Link>` targets, which fires the route
 *      handler's side effect (the cookie write + redirect) on hover/viewport,
 *      before the parent has clicked anything.
 *   2. On click, the soft (RSC) navigation through the route handler's redirect
 *      can abort instead of following through, leaving the parent on the page
 *      they started from — the reported "Open today's mission bounces back to
 *      the parent dashboard" bug.
 *
 * A form-bound Server Action sets the cookie and issues a `redirect()` the
 * router follows deterministically (the same pattern as `startMissionAction` on
 * the learner home and the learner-select picker). The `/learner/select/auto`
 * route handler is kept for server-side `redirect()` callers and the
 * single-child auto-select path; this is the path for user-initiated CTAs.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { ACTIVE_LEARNER_COOKIE, verifyActiveLearner } from "@/lib/auth/active-learner";

export async function enterLearnerHome(formData: FormData): Promise<void> {
  const learnerId = String(formData.get("learnerId") ?? "").trim();
  const session = await requirePageRole(["parent"]);
  // Authorize before trusting the form-supplied id — a parent may only enter a
  // learner they are linked to (verifyActiveLearner returns the id or null).
  const authorized = learnerId ? await verifyActiveLearner(session, learnerId) : null;
  if (!authorized) redirect("/learner/select?error=forbidden");

  const jar = await cookies();
  jar.set({
    name: ACTIVE_LEARNER_COOKIE,
    value: authorized,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/learner/home");
}

/**
 * Server Action: a parent hands the device to the child — a true sign-in AS
 * the learner, gated by the learner's PIN.
 *
 * Unlike `enterLearnerHome` (which keeps the parent session and only sets the
 * active-learner cookie for "parent · learner view"), this SWAPS the session:
 * it verifies the learner's PIN via identity-svc's `pin-login`, then replaces
 * the parent's auth cookies with the learner's so the child is genuinely
 * signed in as themselves. The parent is already authenticated, so `parentId`
 * is taken from the session and the form only collects the PIN.
 *
 * Routing by `verifyLearnerPin` outcome (see services/identity-svc):
 *   - ok       → swap to the learner session, land on /learner/home.
 *   - 404      → the learner has no PIN yet: route to the set-PIN step first.
 *   - 429      → PIN temporarily locked: bounce back with the retry window.
 *   - else     → invalid PIN / unreachable: bounce back with a generic error.
 */
export async function enterAsLearner(formData: FormData): Promise<void> {
  const learnerId = String(formData.get("learnerId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const session = await requirePageRole(["parent"]);
  const authorized = learnerId ? await verifyActiveLearner(session, learnerId) : null;
  if (!authorized) redirect("/learner/select?error=forbidden");
  // Surface-aware error routing: the kid-facing profile picker
  // (/learner/select) and the parent hand-off page
  // (/parent/learners/:id/enter) both post here, but a wrong/locked PIN must
  // bounce the user back to the SAME surface they were on — not kick a child
  // off the picker onto the parent page. The form supplies `returnTo`; we
  // allowlist it (only the picker) to avoid an open redirect, defaulting to
  // the per-learner hand-off page for every other caller.
  const handoff = `/parent/learners/${authorized}/enter`;
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const errorBase = returnTo === "/learner/select" ? "/learner/select" : handoff;
  if (!/^\d{4,6}$/.test(pin)) redirect(`${errorBase}?error=invalid`);

  const { identityPinLogin, extractRefreshToken, toSessionProfile } = await import(
    "@/lib/auth/identity-client"
  );
  const result = await identityPinLogin({ parentId: session.userId, learnerId: authorized, pin });

  if (result.kind === "error") {
    if (result.status === 404) redirect(`/onboarding/pin?learnerId=${encodeURIComponent(authorized)}`);
    if (result.status === 429) redirect(`${errorBase}?error=locked`);
    redirect(`${errorBase}?error=invalid`);
  }

  const profile = toSessionProfile(result.user);
  if (!profile || profile.role !== "learner" || profile.learnerId !== authorized) {
    redirect(`${errorBase}?error=invalid`);
  }
  const learnerProfile = profile;

  const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");
  const jar = await cookies();
  // Drop the parent's active-learner cookie — it's meaningless once the session
  // is the learner (readActiveLearnerFromCookies returns session.learnerId for
  // the learner role), and leaving it set is stale parent state.
  jar.set({ name: ACTIVE_LEARNER_COOKIE, value: "", path: "/", maxAge: 0 });
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile: learnerProfile,
  });
  redirect("/learner/home");
}
