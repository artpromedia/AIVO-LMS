/**
 * Phase 4 — every starter content pack must validate. Failure here means
 * the runtime would refuse to plan a session for that tutor.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateContentPack } from "@aivo/content-pack";
import {
  STARTER_CONTENT_PACKS,
  assertStarterPacksValid,
  getStarterContentPack,
} from "../src/content-packs/index.js";
import { TUTOR_REGISTRY } from "../src/modes/registry.js";

describe("starter content packs (Phase 4)", () => {
  it("includes one pack per catalog tutor", () => {
    const packKeys = Object.keys(STARTER_CONTENT_PACKS).sort();
    const tutorKeys = Object.keys(TUTOR_REGISTRY).sort();
    assert.deepEqual(packKeys, tutorKeys);
  });

  it("every starter pack passes validateContentPack", () => {
    for (const [key, pack] of Object.entries(STARTER_CONTENT_PACKS)) {
      const issues = validateContentPack(pack);
      assert.deepEqual(
        issues,
        [],
        `starter pack for "${key}" failed validation: ${JSON.stringify(issues)}`,
      );
    }
  });

  it("assertStarterPacksValid() does not throw", () => {
    assert.doesNotThrow(() => assertStarterPacksValid());
  });

  it("each pack matches its tutor's declared subject", () => {
    for (const [key, pack] of Object.entries(STARTER_CONTENT_PACKS)) {
      const def = TUTOR_REGISTRY[key as keyof typeof TUTOR_REGISTRY];
      assert.ok(
        def.subjects.includes(pack.subject),
        `starter pack for "${key}" subject "${pack.subject}" is not in tutor.subjects ${JSON.stringify(def.subjects)}`,
      );
    }
  });

  it("each pack's skillGraphRefs overlap the tutor's skillGraphRefs", () => {
    for (const [key, pack] of Object.entries(STARTER_CONTENT_PACKS)) {
      const def = TUTOR_REGISTRY[key as keyof typeof TUTOR_REGISTRY];
      const overlap = pack.skillGraphRefs.some((ref) =>
        def.skillGraphRefs.includes(ref),
      );
      assert.ok(
        overlap,
        `starter pack for "${key}" references no skill graph the tutor declares (pack: ${JSON.stringify(pack.skillGraphRefs)}, tutor: ${JSON.stringify(def.skillGraphRefs)})`,
      );
    }
  });

  it("each pack supplies activities at multiple difficulty levels", () => {
    for (const [key, pack] of Object.entries(STARTER_CONTENT_PACKS)) {
      const levels = new Set(pack.activities.map((a) => a.difficulty));
      assert.ok(
        levels.size >= 2,
        `starter pack for "${key}" only has one difficulty level (${[...levels].join(",")})`,
      );
    }
  });

  it("getStarterContentPack returns undefined for unknown keys", () => {
    assert.equal(getStarterContentPack("not-a-tutor"), undefined);
  });
});
