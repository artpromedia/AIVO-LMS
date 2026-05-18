import { cookies } from "next/headers";
import {
  SENSORY_MODE_COOKIE,
  SENSORY_MODE_DEFAULT,
  resolveSensoryMode,
  type SensoryMode,
} from "./constants";

/**
 * Read the user's sensory mode for SSR.
 *
 * Priority:
 *   1. The `aivo.sensoryMode` cookie (set by the client `SensoryModeProvider`
 *      whenever the user toggles, and seeded server-side after login from
 *      the `assessment-svc` sensory-profile endpoint).
 *   2. Falls back to `SENSORY_MODE_DEFAULT` ("standard") for unauthenticated
 *      visitors and brand-new sessions.
 *
 * Calling pattern: in `app/layout.tsx`, await this once and stamp the result
 * onto `<html data-sensory-mode>` so the very first paint already shows the
 * right palette — no FOUC.
 */
export async function readSensoryModeFromCookies(): Promise<SensoryMode> {
  const store = await cookies();
  return resolveSensoryMode(store.get(SENSORY_MODE_COOKIE)?.value ?? SENSORY_MODE_DEFAULT);
}
