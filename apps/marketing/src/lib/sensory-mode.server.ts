import "server-only";
import { cookies } from "next/headers";
import { resolveSensoryMode, type SensoryMode } from "@aivo/brand";
import { SENSORY_MODE_COOKIE } from "./sensory-mode";

/**
 * Server-only helper: read the visitor's persisted sensory-mode choice
 * from the request cookie. Kept in a separate module so importing the
 * shared constants in `./sensory-mode` from a client component doesn't
 * pull `next/headers` into the client bundle (which is a build error).
 */
export async function getSensoryModeFromCookies(): Promise<SensoryMode> {
  const store = await cookies();
  return resolveSensoryMode(store.get(SENSORY_MODE_COOKIE)?.value);
}
