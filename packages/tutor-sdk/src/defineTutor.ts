import type { TutorDefinition } from "./types.js";

/**
 * `defineTutor` — the recommended way for authors to declare a tutor. It's
 * a no-op at runtime (returns the definition as-is) but anchors type
 * inference so authoring code is autocompleted in the IDE.
 *
 *   export const speechBuddy = defineTutor({
 *     id: "speech-buddy@1.0.0",
 *     schemaVersion: 1,
 *     ...
 *   });
 */
export function defineTutor(def: TutorDefinition): TutorDefinition {
  return def;
}
