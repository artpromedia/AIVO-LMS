/**
 * Tutor registry — maps each `TutorKey` from `@aivo/brand` to its
 * declarative `TutorDefinition` from `@aivo/tutor-sdk`.
 *
 * The registry is the single source of truth that aligns the catalog
 * UI (which lists tutors by `TutorKey`) with the runtime (which loads
 * tutors by `TutorDefinition`). A missing entry surfaces immediately
 * via `getTutorDefinition()` and the type-checked `TUTOR_REGISTRY`.
 *
 * Adding a new tutor:
 *   1. Add the persona to `services/ai-svc/src/ai_svc/prompts/tutor_personas.py`
 *      and reference its key in the definition's `authoringMeta.aiSvcPersonaKey`.
 *   2. Add a `TutorDefinition` file under `services/tutor-svc/src/modes/`.
 *   3. Add an entry to `TUTOR_REGISTRY` below — TypeScript enforces a
 *      definition for every `TutorKey`.
 */
import type { TutorKey } from "@aivo/brand";
import type { TutorDefinition } from "@aivo/tutor-sdk";

import { mathTutor } from "./mathTutor.js";
import { elaTutor } from "./elaTutor.js";
import { scienceTutor } from "./scienceTutor.js";
import { historyTutor } from "./historyTutor.js";
import { codingTutor } from "./codingTutor.js";
import { speechTutor } from "./speechTutor.js";
import { selTutor } from "./selTutor.js";
import { geographyTutor } from "./geographyTutor.js";
import { musicTutor } from "./musicTutor.js";
import { peHealthTutor } from "./peHealthTutor.js";
import { worldLanguagesTutor } from "./worldLanguagesTutor.js";
import { stemEngineeringTutor } from "./stemEngineeringTutor.js";
import { lifeSkillsTutor } from "./lifeSkillsTutor.js";
import { creativeArtsTutor } from "./creativeArtsTutor.js";

/** Every catalog tutor → its declarative `TutorDefinition`. */
export const TUTOR_REGISTRY: Readonly<Record<TutorKey, TutorDefinition>> = {
  nova: mathTutor,
  sage: elaTutor,
  spark: scienceTutor,
  chrono: historyTutor,
  pixel: codingTutor,
  echo: speechTutor,
  harmony: selTutor,
  atlas: geographyTutor,
  cadence: musicTutor,
  vigor: peHealthTutor,
  lingua: worldLanguagesTutor,
  forge: stemEngineeringTutor,
  compass: lifeSkillsTutor,
  muse: creativeArtsTutor,
};

/** Look up a `TutorDefinition` by `TutorKey`. Returns `undefined` if the
 *  caller passes a string outside the catalog (defensive — the type
 *  checker normally catches this at compile time). */
export function getTutorDefinition(key: string): TutorDefinition | undefined {
  return (TUTOR_REGISTRY as Record<string, TutorDefinition>)[key];
}

/** All `(TutorKey, TutorDefinition)` entries in catalog declaration order. */
export function listTutorDefinitions(): Array<[TutorKey, TutorDefinition]> {
  return Object.entries(TUTOR_REGISTRY) as Array<[TutorKey, TutorDefinition]>;
}
