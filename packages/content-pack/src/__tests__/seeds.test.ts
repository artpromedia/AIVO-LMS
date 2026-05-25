/**
 * Sprint E — every seeded content pack must pass the validator.
 *
 * This is the floor for the authored-content slice: a pack that fails
 * validation cannot ship because tutor-runtime's cold-start loader
 * refuses to load it. Adding a new pack to SEEDED_PACKS automatically
 * brings it under this gate.
 */
import { describe, it, expect } from "vitest";
import { SEEDED_PACKS, validateContentPack } from "../index.js";

describe("Sprint E — authored content-pack seeds", () => {
  for (const [id, pack] of Object.entries(SEEDED_PACKS)) {
    it(`${id} passes validateContentPack with no issues`, () => {
      const issues = validateContentPack(pack);
      if (issues.length > 0) {
        // Pretty-print so a regression points at the actual cause.
        const formatted = issues
          .map((i) => `  - [${i.code}] ${i.refId ? `(${i.refId}) ` : ""}${i.detail}`)
          .join("\n");
        throw new Error(`Pack "${id}" failed validation:\n${formatted}`);
      }
      expect(issues).toEqual([]);
    });

    it(`${id} declares activities`, () => {
      expect(pack.activities.length).toBeGreaterThan(0);
    });

    it(`${id} references at least one skill graph`, () => {
      expect(pack.skillGraphRefs.length).toBeGreaterThan(0);
    });
  }

  it("SEEDED_PACKS keys match the contained pack ids", () => {
    for (const [id, pack] of Object.entries(SEEDED_PACKS)) {
      expect(pack.id).toBe(id);
    }
  });
});
