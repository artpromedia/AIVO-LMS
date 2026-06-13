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
