import { describe, expect, it } from "vitest";
import {
  CROSS_CUTTING_REGISTRY,
  CROSS_CUTTING_SURFACES,
  getCrossCuttingSurface,
  getCrossCuttingSurfacesInMigrationOrder,
  NAV_AREAS,
} from "../index.js";

describe("cross-cutting surface registry (ADR 0020 Phase 2)", () => {
  it("declares every surface in CROSS_CUTTING_SURFACES", () => {
    for (const id of CROSS_CUTTING_SURFACES) {
      expect(CROSS_CUTTING_REGISTRY[id]).toBeDefined();
      expect(CROSS_CUTTING_REGISTRY[id].id).toBe(id);
    }
  });

  it("anchors every surface on a canonical NavArea so canAccessArea governs it", () => {
    for (const id of CROSS_CUTTING_SURFACES) {
      const meta = CROSS_CUTTING_REGISTRY[id];
      expect(NAV_AREAS).toContain(meta.navArea);
    }
  });

  it("declares both a webRoute and a mobileRoute for every surface", () => {
    for (const id of CROSS_CUTTING_SURFACES) {
      const meta = CROSS_CUTTING_REGISTRY[id];
      expect(meta.webRoute.startsWith("/")).toBe(true);
      expect(meta.mobileRoute.startsWith("/")).toBe(true);
    }
  });

  it("orders surfaces by migration phase, ascending", () => {
    const ordered = getCrossCuttingSurfacesInMigrationOrder();
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].phase).toBeGreaterThanOrEqual(ordered[i - 1].phase);
    }
    // notifications must come first (phase 1) per the ADR sequence.
    expect(ordered[0].id).toBe("notifications");
    // billing must come last (phase 4) — highest risk.
    expect(ordered[ordered.length - 1].id).toBe("billing");
  });

  it("returns undefined for unknown ids via getCrossCuttingSurface", () => {
    expect(getCrossCuttingSurface("not-a-surface")).toBeUndefined();
  });

  it("returns the matching entry for known ids", () => {
    expect(getCrossCuttingSurface("settings")?.webRoute).toBe("/settings");
  });

  it("pins notifications (Phase 2 slice 1) to /notifications on both shells", () => {
    // ADR 0020 §Phase 2 row 1: the canonical destination for the
    // notifications surface is /notifications on web and mobile.
    // Phase 2 slice 1 (apps/web-v2/app/notifications + apps/mobile/
    // app/notifications.tsx) reads this pin directly, so a registry
    // edit that drops or moves it would silently break the migration.
    const meta = getCrossCuttingSurface("notifications");
    expect(meta?.webRoute).toBe("/notifications");
    expect(meta?.mobileRoute).toBe("/notifications");
    expect(meta?.navArea).toBe("messages");
    expect(meta?.phase).toBe(1);
  });
});
