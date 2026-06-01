import { describe, expect, it } from "vitest";
import {
  ALL_SURFACE_TYPES,
  SURFACE_CAPABILITY_REGISTRY,
  isSurfaceFallback,
  surfaceSupport,
} from "../SurfaceRouter/surface-capability.js";
import { SUPPORTED_RUNTIME_TYPES } from "../SurfaceRouter/surface-type-map.js";

const LEVELS = new Set(["full", "fallback", "none"]);

describe("SURFACE_CAPABILITY_REGISTRY", () => {
  it("declares a web + mobile support level for every surface type", () => {
    expect(ALL_SURFACE_TYPES.length).toBeGreaterThan(0);
    for (const type of ALL_SURFACE_TYPES) {
      const cap = SURFACE_CAPABILITY_REGISTRY[type];
      expect(cap, `missing capability entry for "${type}"`).toBeTruthy();
      expect(LEVELS.has(cap.web), `bad web level for "${type}"`).toBe(true);
      expect(LEVELS.has(cap.mobile), `bad mobile level for "${type}"`).toBe(true);
      expect(typeof cap.note).toBe("string");
    }
  });

  it("agrees with the web SurfaceRouter's SUPPORTED_RUNTIME_TYPES", () => {
    // A surface the web router actually routes must be marked web:"full"; one it
    // does not must NOT be marked full. This keeps the registry honest against
    // the real renderer instead of drifting into wishful claims.
    for (const type of ALL_SURFACE_TYPES) {
      const routed = SUPPORTED_RUNTIME_TYPES.has(type);
      const full = surfaceSupport(type, "web") === "full";
      expect(full, `web capability for "${type}" disagrees with the router`).toBe(routed);
    }
  });

  it("treats non-full levels as a fallback on each platform", () => {
    for (const type of ALL_SURFACE_TYPES) {
      for (const platform of ["web", "mobile"] as const) {
        const full = surfaceSupport(type, platform) === "full";
        expect(isSurfaceFallback(type, platform)).toBe(!full);
      }
    }
  });
});
