import { test } from "node:test";
import * as assert from "node:assert/strict";

process.env.MFA_ENCRYPTION_KEY = "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff";

import {
  encryptSecret,
  decryptSecret,
  hashOtpCode,
  timingSafeEqualHex,
  generateRecoveryCodes,
  canonicalizeRecoveryCode,
  looksLikeRecoveryCode,
  _resetMfaKeyCache,
} from "../src/mfa-crypto.js";

test("encryptSecret/decryptSecret round-trip", () => {
  const plain = "JBSWY3DPEHPK3PXP";
  const env = encryptSecret(plain);
  assert.match(env, /^v1:/);
  assert.notEqual(env, plain);
  assert.equal(decryptSecret(env), plain);
});

test("decryptSecret rejects tampered ciphertext", () => {
  const env = encryptSecret("hello world");
  const parts = env.split(":");
  parts[3] = Buffer.from("00000000", "base64").toString("base64");
  assert.throws(() => decryptSecret(parts.join(":")));
});

test("decryptSecret rejects unknown envelope versions", () => {
  assert.throws(() => decryptSecret("v9:a:b:c"));
  assert.throws(() => decryptSecret("not-an-envelope"));
});

test("encryptSecret produces fresh IV per call", () => {
  const a = encryptSecret("same-input");
  const b = encryptSecret("same-input");
  assert.notEqual(a, b);
});

test("hashOtpCode is deterministic and 64-hex", () => {
  const h = hashOtpCode("123456");
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashOtpCode("123456"));
});

test("timingSafeEqualHex matches identical hashes only", () => {
  const h = hashOtpCode("abc");
  assert.equal(timingSafeEqualHex(h, h), true);
  assert.equal(timingSafeEqualHex(h, hashOtpCode("abd")), false);
  assert.equal(timingSafeEqualHex(h, h.slice(0, -1)), false);
});

test("generateRecoveryCodes returns 10 unique formatted codes", () => {
  const { plain, canonical } = generateRecoveryCodes();
  assert.equal(plain.length, 10);
  assert.equal(canonical.length, 10);
  for (const p of plain) {
    assert.match(p, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  }
  for (const c of canonical) {
    assert.match(c, /^[A-Z2-9]{12}$/);
    assert.equal(c.length, 12);
  }
  // Uniqueness — RNG collision in 10 codes from 32^12 space is astronomically improbable
  assert.equal(new Set(canonical).size, 10);
});

test("canonicalizeRecoveryCode is case-insensitive and strips dashes/spaces", () => {
  assert.equal(canonicalizeRecoveryCode("ab12-cd34-ef56"), "AB12CD34EF56");
  assert.equal(canonicalizeRecoveryCode("  ab 12 cd34 ef 56 "), "AB12CD34EF56");
});

test("looksLikeRecoveryCode rejects 6-digit OTPs and accepts 12-char codes", () => {
  assert.equal(looksLikeRecoveryCode("123456"), false);
  assert.equal(looksLikeRecoveryCode("ABCD-EFGH-JKLM"), true);
  assert.equal(looksLikeRecoveryCode(""), false);
});

test("missing key in production throws", () => {
  const prevKey = process.env.MFA_ENCRYPTION_KEY;
  const prevEnv = process.env.NODE_ENV;
  delete process.env.MFA_ENCRYPTION_KEY;
  process.env.NODE_ENV = "production";
  _resetMfaKeyCache();
  assert.throws(() => encryptSecret("x"), /MFA_ENCRYPTION_KEY/);
  process.env.MFA_ENCRYPTION_KEY = prevKey;
  process.env.NODE_ENV = prevEnv;
  _resetMfaKeyCache();
});
