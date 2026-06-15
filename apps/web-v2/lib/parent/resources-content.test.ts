import { describe, expect, it } from "vitest";
import {
  listResources,
  getResource,
  searchResources,
  RESOURCE_CATEGORIES,
} from "./resources-content";

describe("resources content", () => {
  it("returns resources newest-update first", () => {
    const all = listResources();
    expect(all.length).toBeGreaterThan(0);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].updatedAt >= all[i].updatedAt).toBe(true);
    }
  });

  it("every resource cites at least one source (sourced claims)", () => {
    for (const r of listResources()) {
      expect(r.sources.length).toBeGreaterThan(0);
      for (const s of r.sources) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.publisher.length).toBeGreaterThan(0);
      }
    }
  });

  it("every resource uses a known category", () => {
    for (const r of listResources()) {
      expect(RESOURCE_CATEGORIES).toContain(r.category);
    }
  });

  it("resolves a resource by slug and returns null for unknown", () => {
    const first = listResources()[0];
    expect(getResource(first.slug)?.slug).toBe(first.slug);
    expect(getResource("does-not-exist")).toBeNull();
  });

  it("search matches title, tags, and body; all terms must match", () => {
    const all = listResources();
    expect(searchResources(all, "IEP").some((r) => r.slug === "preparing-for-an-iep-meeting")).toBe(
      true,
    );
    // A term that appears in tags.
    expect(searchResources(all, "sensory").length).toBeGreaterThan(0);
    // Two terms where only one matches → excluded.
    expect(searchResources(all, "iep zzzznomatch")).toHaveLength(0);
  });

  it("filters by category", () => {
    const all = listResources();
    const advocacy = searchResources(all, "", "advocacy");
    expect(advocacy.length).toBeGreaterThan(0);
    expect(advocacy.every((r) => r.category === "advocacy")).toBe(true);
    expect(searchResources(all, "", "all").length).toBe(all.length);
  });
});
