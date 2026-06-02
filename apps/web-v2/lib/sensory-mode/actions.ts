"use server";

import { cookies } from "next/headers";
import { SENSORY_MODE_COOKIE, resolveSensoryMode, type SensoryMode } from "./constants";

/**
 * Persist the user's chosen sensory mode in a long-lived cookie so the
 * server can stamp `<html data-sensory-mode>` on the next request (no
 * client-side flicker).
 *
 * This is the only writer of the `aivo.sensoryMode` cookie. Persistence is
 * intentionally THIS-BROWSER-ONLY today — the choice is not synced to
 * `assessment-svc /sensory-profile`, so a user logging in from a different
 * device will start fresh at "standard". A future backend sprint can wire
 * cross-device sync; until then, do not advertise multi-device behavior
 * in user-facing copy.
 */
export async function setSensoryModeCookie(mode: SensoryMode | string): Promise<void> {
  const resolved = resolveSensoryMode(mode);
  const store = await cookies();
  store.set(SENSORY_MODE_COOKIE, resolved, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false, // readable by client provider for hydration consistency
  });
}
