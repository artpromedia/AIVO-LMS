/**
 * Sensory-mode constants for apps/web-v2.
 *
 * Re-exports the canonical types from `@aivo/brand` so the rest of the app
 * has a single import surface and we can swap implementations later
 * (e.g. backend-driven personalization) without churning every call site.
 */
import {
  SENSORY_MODES,
  SENSORY_MODE_LABELS,
  resolveSensoryMode,
  type SensoryMode,
} from "@aivo/brand";

export const SENSORY_MODE_COOKIE = "aivo.sensoryMode";
export const SENSORY_MODE_DEFAULT: SensoryMode = "standard";

export { SENSORY_MODES, SENSORY_MODE_LABELS, resolveSensoryMode };
export type { SensoryMode };
