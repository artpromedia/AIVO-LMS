/**
 * Parent phone-verification store tests — challenge issue/verify lifecycle,
 * expiry, attempt-limit, and the never-echo-the-secret guarantees.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetParentPhoneStore,
  getPhoneStatus,
  normalizePhone,
  startPhoneChallenge,
  verifyPhoneChallenge,
  PHONE_CODE_TTL_MIN,
  PHONE_MAX_ATTEMPTS,
} from "@/lib/db/parent-phone-store";

describe("parent-phone-store", () => {
  beforeEach(() => _resetParentPhoneStore());

  it("normalizes plausible numbers and rejects junk", () => {
    expect(normalizePhone("+1 (555) 010-2345")).toBe("+15550102345");
    expect(normalizePhone("5550102345")).toBe("5550102345");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
    expect(normalizePhone(42)).toBeNull();
  });

  it("issues a 6-digit code and reports a pending (masked) phone", () => {
    const { code, phone } = startPhoneChallenge("u1", "+15550102345");
    expect(code).toMatch(/^\d{6}$/);
    expect(phone).toBe("+15550102345");
    const status = getPhoneStatus("u1");
    expect(status.phoneVerified).toBe(false);
    expect(status.pendingPhone).toContain("2345");
    // The full number is never echoed back in status.
    expect(status.pendingPhone).not.toContain("+15550102345");
  });

  it("verifies a correct code and records the verified number", () => {
    const { code } = startPhoneChallenge("u1", "+15550102345");
    const result = verifyPhoneChallenge("u1", code);
    expect(result).toEqual({ ok: true, phone: "+15550102345" });
    const status = getPhoneStatus("u1");
    expect(status.phoneVerified).toBe(true);
    expect(status.pendingPhone).toBeNull();
    // Single-use: the same code can't be replayed.
    expect(verifyPhoneChallenge("u1", code)).toEqual({ ok: false, reason: "no_challenge" });
  });

  it("rejects a wrong code and burns the challenge after the attempt limit", () => {
    startPhoneChallenge("u1", "+15550102345");
    for (let i = 1; i < PHONE_MAX_ATTEMPTS; i++) {
      expect(verifyPhoneChallenge("u1", "000000")).toEqual({ ok: false, reason: "mismatch" });
    }
    expect(verifyPhoneChallenge("u1", "000000")).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });
    // Challenge is now gone.
    expect(verifyPhoneChallenge("u1", "111111")).toEqual({ ok: false, reason: "no_challenge" });
  });

  it("expires a code after its TTL", () => {
    const now = Date.now();
    const { code } = startPhoneChallenge("u1", "+15550102345", now);
    const past = now + PHONE_CODE_TTL_MIN * 60 * 1000 + 1;
    expect(verifyPhoneChallenge("u1", code, past)).toEqual({ ok: false, reason: "expired" });
  });
});
