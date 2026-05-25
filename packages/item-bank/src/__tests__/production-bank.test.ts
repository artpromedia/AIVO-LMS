/**
 * Production bank assertions (Sprint 3).
 *
 * These tests are the package-local mirror of
 * `scripts/curriculum-coverage-check.mjs`: every required subject must
 * have at least 20 production items, every variant must validate, and
 * every surfaceType must be routable by the lesson-player SurfaceRouter.
 *
 * The script lives at the repo level so CI can run it independently of
 * package builds; these tests fail-fast at the package level so a
 * curriculum author breaks `pnpm --filter @aivo/item-bank test` before
 * the repo-level gate.
 */
import { describe, expect, it } from "vitest";
import {
  getAllProductionItems,
  getProductionItemCounts,
  getProductionItemsForSubject,
  type RequiredSubjectSlug,
} from "../production.js";
import { ROUTABLE_SURFACE_TYPES, validateItemVariant } from "../validate.js";

const REQUIRED_SUBJECTS: RequiredSubjectSlug[] = ["math", "ela", "science", "writing"];
const MIN_ITEMS_PER_SUBJECT = 20;

describe("production item bank — coverage", () => {
  it.each(REQUIRED_SUBJECTS)(
    "%s has at least %d items",
    (subject) => {
      const items = getProductionItemsForSubject(subject);
      expect(items.length).toBeGreaterThanOrEqual(MIN_ITEMS_PER_SUBJECT);
    },
  );

  it("getProductionItemCounts returns ≥20 per subject", () => {
    const counts = getProductionItemCounts();
    for (const subject of REQUIRED_SUBJECTS) {
      expect(counts[subject], `${subject} below threshold`).toBeGreaterThanOrEqual(
        MIN_ITEMS_PER_SUBJECT,
      );
    }
  });
});

describe("production item bank — every item is well-formed", () => {
  const allItems = getAllProductionItems();

  it("every item has a stable id and skillId", () => {
    for (const item of allItems) {
      expect(item.id, "item missing id").toBeTruthy();
      expect(item.skillId, `${item.id} missing skillId`).toBeTruthy();
      expect(item.variants.length, `${item.id} has no variants`).toBeGreaterThan(0);
    }
  });

  it("every variant passes validateItemVariant", () => {
    for (const item of allItems) {
      for (const variant of item.variants) {
        const issues = validateItemVariant(variant);
        expect(issues, `validation issues on ${variant.id}: ${JSON.stringify(issues)}`).toEqual([]);
      }
    }
  });

  it("every variant uses a router-supported surface type", () => {
    for (const item of allItems) {
      for (const variant of item.variants) {
        expect(
          variant.surfaceType && ROUTABLE_SURFACE_TYPES.has(variant.surfaceType),
          `${variant.id} surfaceType "${variant.surfaceType}" is not router-supported`,
        ).toBe(true);
      }
    }
  });

  it("item ids are unique across the production bank", () => {
    const seen = new Set<string>();
    for (const item of allItems) {
      expect(seen.has(item.id), `duplicate item id: ${item.id}`).toBe(false);
      seen.add(item.id);
    }
  });

  it("variant ids are unique across the production bank", () => {
    const seen = new Set<string>();
    for (const item of allItems) {
      for (const variant of item.variants) {
        expect(seen.has(variant.id), `duplicate variant id: ${variant.id}`).toBe(false);
        seen.add(variant.id);
      }
    }
  });
});

describe("production item bank — skill-id attribution", () => {
  it("math items reference a math skill id", () => {
    for (const item of getProductionItemsForSubject("math")) {
      expect(item.skillId.toLowerCase(), `${item.id}`).toMatch(/math/);
    }
  });

  it("ela items reference an ela or reading skill id", () => {
    for (const item of getProductionItemsForSubject("ela")) {
      expect(item.skillId.toLowerCase(), `${item.id}`).toMatch(/ela|reading/);
    }
  });

  it("science items reference an ngss or science skill id", () => {
    for (const item of getProductionItemsForSubject("science")) {
      expect(item.skillId.toLowerCase(), `${item.id}`).toMatch(/ngss|science/);
    }
  });

  it("writing items reference a writing skill id", () => {
    for (const item of getProductionItemsForSubject("writing")) {
      expect(item.skillId.toLowerCase(), `${item.id}`).toMatch(/writing/);
    }
  });
});
