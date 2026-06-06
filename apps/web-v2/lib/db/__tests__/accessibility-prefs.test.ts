/**
 * Accessibility preferences — the calmAudioCues opt-in defaults to false and
 * round-trips through update/reset (the persistence layer already carries
 * arbitrary profile fields; this pins the new field's behaviour).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetStore } from "@/lib/db/store";
import { ensureSeeded } from "@/lib/db/seed";
import {
  getAccessibilityPrefs,
  updateAccessibilityPrefs,
  resetAccessibilityPrefs,
} from "@/lib/db/repos";
import { ACCESSIBILITY_DEFAULTS } from "@/lib/db/types";

// The persistence layer stores prefs on the learner profile, so use a
// seeded learner that actually exists in the store.
const LEARNER = "lrn_demo_sky";
const TENANT = "t_demo";

describe("accessibility prefs — calmAudioCues", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("defaults to false", () => {
    expect(ACCESSIBILITY_DEFAULTS.calmAudioCues).toBe(false);
  });

  it("returns the default (false) when nothing is stored", async () => {
    const prefs = await getAccessibilityPrefs(LEARNER, TENANT);
    expect(prefs.calmAudioCues).toBe(false);
  });

  it("round-trips through update and back through reset", async () => {
    const updated = await updateAccessibilityPrefs(LEARNER, TENANT, { calmAudioCues: true });
    expect(updated.calmAudioCues).toBe(true);

    const reread = await getAccessibilityPrefs(LEARNER, TENANT);
    expect(reread.calmAudioCues).toBe(true);

    const reset = await resetAccessibilityPrefs(LEARNER, TENANT);
    expect(reset.calmAudioCues).toBe(false);
  });

  it("leaves other preferences untouched when toggling calmAudioCues", async () => {
    await updateAccessibilityPrefs(LEARNER, TENANT, { highContrast: true });
    const updated = await updateAccessibilityPrefs(LEARNER, TENANT, { calmAudioCues: true });
    expect(updated.highContrast).toBe(true);
    expect(updated.calmAudioCues).toBe(true);
  });
});
