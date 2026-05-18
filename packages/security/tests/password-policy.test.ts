import { test } from "node:test";
import assert from "node:assert";
import {
  evaluatePassword,
  minLengthFor,
  isPasswordRotationDue,
  isInternalRoleForPolicy,
  PASSWORD_HISTORY_DEPTH,
} from "../src/password-policy.js";

test("min length: internal roles need 14, public roles need 12", () => {
  assert.equal(minLengthFor("PLATFORM_ADMIN"), 14);
  assert.equal(minLengthFor("DISTRICT_ADMIN"), 14);
  assert.equal(minLengthFor("TEACHER"), 12);
  assert.equal(minLengthFor("CAREGIVER"), 12);
  assert.equal(minLengthFor(undefined), 12);
});

test("evaluatePassword: rejects too-short", async () => {
  const r = await evaluatePassword("short", { skipBreachCheck: true });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("too_short"));
});

test("evaluatePassword: rejects common blocklist password", async () => {
  const r = await evaluatePassword("Password1234!", { skipBreachCheck: true });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("too_weak"));
});

test("evaluatePassword: accepts strong diverse passphrase", async () => {
  const r = await evaluatePassword("Tr0pical-Yak#whispers!Galaxy", {
    skipBreachCheck: true,
    role: "DISTRICT_ADMIN",
    email: "alice@example.org",
    name: "Alice Doe",
  });
  assert.equal(r.ok, true, `Expected ok, got reasons=${JSON.stringify(r.reasons)}`);
  assert.ok(r.strengthScore >= 3);
});

test("evaluatePassword: penalizes scores when email local-part is embedded", async () => {
  const withEmail = await evaluatePassword("alicepasswordHere1!", {
    skipBreachCheck: true,
    email: "alice@example.org",
  });
  const withoutEmail = await evaluatePassword("alicepasswordHere1!", {
    skipBreachCheck: true,
    email: "bob@example.org",
  });
  // The personal-info penalty must reduce the score (or at minimum not raise it).
  assert.ok(
    withEmail.strengthScore <= withoutEmail.strengthScore,
    `email-embedded score (${withEmail.strengthScore}) must not exceed neutral score (${withoutEmail.strengthScore})`,
  );
});

test("evaluatePassword: requires 3 character classes for internal roles", async () => {
  // 14 chars but only lowercase + digits = 2 classes
  const r = await evaluatePassword("abcdefghijklm1", {
    skipBreachCheck: true,
    role: "PLATFORM_ADMIN",
  });
  assert.ok(r.reasons.includes("missing_diversity") || r.reasons.includes("too_weak"));
});

test("evaluatePassword: invokes historyVerifier and reports reuse", async () => {
  let called = false;
  const r = await evaluatePassword("Tr0pical-Yak#whispers!Galaxy", {
    skipBreachCheck: true,
    historyVerifier: async () => {
      called = true;
      return true;
    },
  });
  assert.equal(called, true);
  assert.ok(r.reasons.includes("reused"));
  assert.equal(r.ok, false);
});

test("evaluatePassword: history failure does not block", async () => {
  const r = await evaluatePassword("Tr0pical-Yak#whispers!Galaxy", {
    skipBreachCheck: true,
    historyVerifier: async () => {
      throw new Error("db down");
    },
  });
  assert.equal(r.ok, true);
});

test("isInternalRoleForPolicy: covers staff roles only", () => {
  assert.equal(isInternalRoleForPolicy("PLATFORM_ADMIN"), true);
  assert.equal(isInternalRoleForPolicy("DISTRICT_ADMIN"), true);
  assert.equal(isInternalRoleForPolicy("SUPPORT"), true);
  assert.equal(isInternalRoleForPolicy("TEACHER"), false);
  assert.equal(isInternalRoleForPolicy("CAREGIVER"), false);
  assert.equal(isInternalRoleForPolicy("LEARNER"), false);
});

test("isPasswordRotationDue: internal role beyond 365 days is due", () => {
  const old = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000);
  const fresh = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  assert.equal(isPasswordRotationDue(old, "PLATFORM_ADMIN"), true);
  assert.equal(isPasswordRotationDue(fresh, "PLATFORM_ADMIN"), false);
  // Public roles never get force-rotated
  assert.equal(isPasswordRotationDue(old, "TEACHER"), false);
  // Null timestamp on an internal role => treat as due so we backfill safely.
  assert.equal(isPasswordRotationDue(null, "PLATFORM_ADMIN"), true);
});

test("PASSWORD_HISTORY_DEPTH is at least 5 for sane reuse window", () => {
  assert.ok(PASSWORD_HISTORY_DEPTH >= 5);
});
