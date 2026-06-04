/**
 * TOTP tests — validated against the published RFC 6238 Appendix B test
 * vectors (SHA-1, secret = ASCII "12345678901234567890", 8 digits).
 */
import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  totp,
  verifyTotp,
  generateTotpSecret,
  otpauthUrl,
} from "./totp";

const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

const VECTORS: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
];

describe("totp (RFC 6238)", () => {
  it("matches the RFC 6238 SHA-1 8-digit vectors", () => {
    for (const [t, expected] of VECTORS) {
      expect(totp(RFC_SECRET, { now: t * 1000, digits: 8, algorithm: "sha1" })).toBe(expected);
    }
  });

  it("base32 round-trips arbitrary bytes", () => {
    const buf = Buffer.from("the quick brown fox");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it("generates a 32-char (160-bit) base32 secret by default", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(s).length).toBe(20);
  });

  it("verifyTotp accepts the current code and rejects a wrong one", () => {
    const now = 1700000000000;
    const code = totp(RFC_SECRET, { now });
    expect(verifyTotp(RFC_SECRET, code, { now })).toBe(true);
    expect(verifyTotp(RFC_SECRET, "000000", { now })).toBe(false);
  });

  it("verifyTotp tolerates ±1 step of drift but not more", () => {
    const now = 1700000000000;
    const prev = totp(RFC_SECRET, { now: now - 30000 });
    const tooOld = totp(RFC_SECRET, { now: now - 90000 });
    expect(verifyTotp(RFC_SECRET, prev, { now, window: 1 })).toBe(true);
    expect(verifyTotp(RFC_SECRET, tooOld, { now, window: 1 })).toBe(false);
  });

  it("verifyTotp rejects non-numeric or wrong-length input", () => {
    const now = 1700000000000;
    expect(verifyTotp(RFC_SECRET, "abcdef", { now })).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", { now })).toBe(false);
  });

  it("otpauthUrl encodes issuer, account, and secret", () => {
    const url = new URL(otpauthUrl({ secret: "ABC", accountName: "a@b.test", issuer: "AIVO" }));
    expect(url.protocol).toBe("otpauth:");
    expect(url.searchParams.get("secret")).toBe("ABC");
    expect(url.searchParams.get("issuer")).toBe("AIVO");
    expect(decodeURIComponent(url.pathname)).toContain("AIVO:a@b.test");
  });
});
