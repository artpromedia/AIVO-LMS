import { resolveSensoryMode, type SensoryMode } from "@aivo/brand";

export type { SensoryMode };

/**
 * Cookie used to remember a visitor's sensory-mode choice across pages.
 *
 * Read on the server in the root layout (so the very first paint already
 * has the right CSS variables applied — no flash of unstyled content),
 * written from the client via POST /api/sensory-mode when a visitor
 * toggles the pill in the nav.
 *
 * This module is safe to import from both client and server components.
 * The server-only `cookies()` reader lives in ./sensory-mode.server.ts so
 * `next/headers` doesn't get pulled into the client bundle.
 */
export const SENSORY_MODE_COOKIE = "aivo_sensory_mode";

/** One year, in seconds. The choice is a strong UX preference and should persist. */
export const SENSORY_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const SENSORY_MODES_ORDERED: readonly SensoryMode[] = [
  "standard",
  "calm",
  "high-contrast",
] as const;

/** Next sensory mode in the standard → calm → high-contrast → standard cycle. */
export function nextSensoryMode(current: SensoryMode): SensoryMode {
  const idx = SENSORY_MODES_ORDERED.indexOf(current);
  return SENSORY_MODES_ORDERED[(idx + 1) % SENSORY_MODES_ORDERED.length];
}

/** Re-exported for callers that want to normalize an arbitrary cookie value. */
export { resolveSensoryMode };
