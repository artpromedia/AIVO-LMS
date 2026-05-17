import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSpeechBuddyEnabled,
  loadSpeechBuddyFlags,
  SPEECH_BUDDY_AGE_BANDS,
} from "../src/flags.js";

describe("speech_buddy.enabled feature flag", () => {
  it("defaults OFF for every (tenant, band) tuple when no env is set", () => {
    const flags = loadSpeechBuddyFlags({} as NodeJS.ProcessEnv);
    assert.equal(flags.globalBands.size, 0);
    assert.equal(flags.perTenantBands.size, 0);
    for (const band of SPEECH_BUDDY_AGE_BANDS) {
      assert.equal(isSpeechBuddyEnabled("tenant-a", band, flags), false);
      assert.equal(isSpeechBuddyEnabled("tenant-b", band, flags), false);
    }
  });

  it("OFF for empty / unknown tenant id even when global is set", () => {
    const flags = loadSpeechBuddyFlags({
      SPEECH_BUDDY_ENABLED_GLOBAL: "all",
    } as NodeJS.ProcessEnv);
    assert.equal(isSpeechBuddyEnabled("", "6-9", flags), false);
  });

  it("parses per-tenant band lists and only enables those tuples", () => {
    const flags = loadSpeechBuddyFlags({
      SPEECH_BUDDY_ENABLED_TENANTS: "tenantA:6-9,10-12;tenantB:13-15",
    } as NodeJS.ProcessEnv);
    assert.equal(isSpeechBuddyEnabled("tenantA", "6-9", flags), true);
    assert.equal(isSpeechBuddyEnabled("tenantA", "10-12", flags), true);
    assert.equal(isSpeechBuddyEnabled("tenantA", "13-15", flags), false);
    assert.equal(isSpeechBuddyEnabled("tenantB", "13-15", flags), true);
    assert.equal(isSpeechBuddyEnabled("tenantB", "6-9", flags), false);
    assert.equal(isSpeechBuddyEnabled("tenantC", "6-9", flags), false);
  });

  it("global=all enables every band for any non-empty tenant", () => {
    const flags = loadSpeechBuddyFlags({
      SPEECH_BUDDY_ENABLED_GLOBAL: "all",
    } as NodeJS.ProcessEnv);
    for (const band of SPEECH_BUDDY_AGE_BANDS) {
      assert.equal(isSpeechBuddyEnabled("any-tenant", band, flags), true);
    }
  });

  it("ignores unknown bands silently (forward-compat)", () => {
    const flags = loadSpeechBuddyFlags({
      SPEECH_BUDDY_ENABLED_TENANTS: "tenantA:6-9,99-100",
    } as NodeJS.ProcessEnv);
    assert.equal(isSpeechBuddyEnabled("tenantA", "6-9", flags), true);
    assert.equal(flags.perTenantBands.get("tenantA")?.size, 1);
  });

  it("treats off / disabled / empty as no bands", () => {
    for (const v of ["", "off", "disabled"]) {
      const flags = loadSpeechBuddyFlags({
        SPEECH_BUDDY_ENABLED_GLOBAL: v,
      } as NodeJS.ProcessEnv);
      for (const band of SPEECH_BUDDY_AGE_BANDS) {
        assert.equal(isSpeechBuddyEnabled("any", band, flags), false);
      }
    }
  });
});
