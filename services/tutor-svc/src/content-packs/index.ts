/**
 * Starter content packs — one per catalog tutor.
 *
 * These packs are the engineering scaffold described in Phase 4 of the
 * tutor-rollout plan. They give every tutor enough validated activities
 * to drive `planSession()` end-to-end while the curriculum/SME team
 * authors deeper packs in the CMS.
 *
 * Each pack:
 *   - declares the same `Subject` / skill-graph the matching tutor does
 *   - has activities at all three difficulty levels (intro/core/stretch)
 *     so retrieval, scaffolding, and stretch selection all have material
 *   - is validated at module load via `validateContentPack` so a regression
 *     fails the tutor-svc build instead of failing at request time
 *
 * The plan route falls back to this map when no `contentPack` is supplied
 * in the request body (see `routes/tutorSession.ts`).
 */
import type { TutorKey } from "@aivo/brand";
import { validateContentPack, type ContentPack } from "@aivo/content-pack";

import { atlasStarterPack } from "./atlas.pack.js";
import { cadenceStarterPack } from "./cadence.pack.js";
import { chronoStarterPack } from "./chrono.pack.js";
import { compassStarterPack } from "./compass.pack.js";
import { echoStarterPack } from "./echo.pack.js";
import { forgeStarterPack } from "./forge.pack.js";
import { harmonyStarterPack } from "./harmony.pack.js";
import { linguaStarterPack } from "./lingua.pack.js";
import { museStarterPack } from "./muse.pack.js";
import { novaStarterPack } from "./nova.pack.js";
import { pixelStarterPack } from "./pixel.pack.js";
import { sageStarterPack } from "./sage.pack.js";
import { sparkStarterPack } from "./spark.pack.js";
import { vigorStarterPack } from "./vigor.pack.js";

/** Every catalog tutor → its starter `ContentPack`. */
export const STARTER_CONTENT_PACKS: Readonly<Record<TutorKey, ContentPack>> = {
  nova: novaStarterPack,
  sage: sageStarterPack,
  spark: sparkStarterPack,
  chrono: chronoStarterPack,
  pixel: pixelStarterPack,
  echo: echoStarterPack,
  harmony: harmonyStarterPack,
  atlas: atlasStarterPack,
  cadence: cadenceStarterPack,
  vigor: vigorStarterPack,
  lingua: linguaStarterPack,
  forge: forgeStarterPack,
  compass: compassStarterPack,
  muse: museStarterPack,
};

/** Look up the starter pack for a given tutor key. Returns `undefined`
 *  for unknown keys (defensive — type checker normally catches this). */
export function getStarterContentPack(key: string): ContentPack | undefined {
  return (STARTER_CONTENT_PACKS as Record<string, ContentPack>)[key];
}

/** Run validation on every starter pack. Throws on the first invalid
 *  pack so the host (tests, server boot) fails fast. */
export function assertStarterPacksValid(): void {
  for (const [key, pack] of Object.entries(STARTER_CONTENT_PACKS)) {
    const issues = validateContentPack(pack);
    if (issues.length > 0) {
      const detail = issues
        .map((i) => `[${i.code}${i.refId ? ` ${i.refId}` : ""}] ${i.detail}`)
        .join("\n  ");
      throw new Error(`Starter content pack for tutor "${key}" failed validation:\n  ${detail}`);
    }
  }
}
