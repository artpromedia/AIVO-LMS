/**
 * MFA store tests — TOTP enrollment lifecycle and step-up grant TTL.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetMfaStore,
  startTotpEnrollment,
  getTotpFactor,
  getMfaStatus,
  activateTotpFactor,
  removeTotpFactor,
  grantStepUp,
  hasRecentStepUp,
  clearStepUp,
  STEP_UP_TTL_SEC,
} from "@/lib/db/mfa-store";

describe("mfa-store", () => {
  beforeEach(() => _resetMfaStore());

  it("starts TOTP enrollment in pending state with a base32 secret", () => {
    const f = startTotpEnrollment("u1");
    expect(f.status).toBe("pending");
    expect(f.secret).toMatch(/^[A-Z2-7]+$/);
    expect(getMfaStatus("u1")).toEqual({ totpEnrolled: false, totpPending: true });
  });

  it("activates a pending factor and reports enrolled", () => {
    startTotpEnrollment("u1");
    expect(activateTotpFactor("u1")).toBe(true);
    expect(getTotpFactor("u1")?.status).toBe("active");
    expect(getMfaStatus("u1")).toEqual({ totpEnrolled: true, totpPending: false });
    // Re-activating an active factor is a no-op.
    expect(activateTotpFactor("u1")).toBe(false);
  });

  it("restarting enrollment mints a fresh secret", () => {
    const a = startTotpEnrollment("u1").secret;
    const b = startTotpEnrollment("u1").secret;
    expect(a).not.toBe(b);
    expect(getTotpFactor("u1")?.status).toBe("pending");
  });

  it("removes a factor", () => {
    startTotpEnrollment("u1");
    expect(removeTotpFactor("u1")).toBe(true);
    expect(getTotpFactor("u1")).toBeNull();
  });

  it("grants a step-up that expires after the TTL", () => {
    const now = 1_000_000;
    grantStepUp("u1", STEP_UP_TTL_SEC, now);
    expect(hasRecentStepUp("u1", now + 1000)).toBe(true);
    expect(hasRecentStepUp("u1", now + STEP_UP_TTL_SEC * 1000 - 1)).toBe(true);
    expect(hasRecentStepUp("u1", now + STEP_UP_TTL_SEC * 1000 + 1)).toBe(false);
  });

  it("clears a step-up grant", () => {
    const now = 1_000_000;
    grantStepUp("u1", STEP_UP_TTL_SEC, now);
    clearStepUp("u1");
    expect(hasRecentStepUp("u1", now + 1000)).toBe(false);
  });

  it("reports no recent step-up for an unknown user", () => {
    expect(hasRecentStepUp("nobody")).toBe(false);
  });
});
