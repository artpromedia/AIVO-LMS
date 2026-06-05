/**
 * Resolve the active lesson accommodations from the learner's accessibility +
 * audio preferences.
 *
 * `resolveLessonAccommodations` (lib/preferences-logic) is the single mapping
 * from raw prefs to the affordances a lesson surface honors (read-aloud,
 * captions, extended time, reduced motion, text scale). Until this hook existed
 * the resolver had no caller, so those four preferences were inert on mobile —
 * persisted and shown in settings but never applied to a lesson. This hook is
 * the consumer; surfaces call it and render accordingly.
 */
import { usePreferences } from "@/lib/preferences";
import {
  resolveLessonAccommodations,
  type LessonAccommodations,
} from "@/lib/preferences-logic";

export function useLessonAccommodations(opts?: { extendedTime?: boolean }): LessonAccommodations {
  const { a11y, audio } = usePreferences();
  return resolveLessonAccommodations(a11y, audio, opts);
}
