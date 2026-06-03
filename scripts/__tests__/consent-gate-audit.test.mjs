// consent:audit regex guard.
//
// The audit script must accept BOTH `export function requireLearnerConsent`
// AND `export async function requireLearnerConsent` — making the guard's
// regex async-agnostic stops a brittle false-positive whenever the guard
// implementation is refactored to/from an async function. This test
// asserts the regex matches both forms and still rejects unrelated
// exports, so the guard cannot be silently weakened (e.g. by widening
// to match `export function \w+`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const auditPath = join(__dirname, "..", "consent-gate-audit.mjs");
const src = readFileSync(auditPath, "utf8");

// Pull the regex literal out of the audit source so this test verifies
// the live guard rather than a copy that can drift.
const m = src.match(/\/export[^/]*function requireLearnerConsent[^/]*\//);
assert.ok(m, "could not locate the requireLearnerConsent guard regex in consent-gate-audit.mjs");
const guardRe = new RegExp(m[0].slice(1, -1));

test("matches `export function requireLearnerConsent`", () => {
  assert.ok(guardRe.test("export function requireLearnerConsent(req, ctx) {"));
});

test("matches `export async function requireLearnerConsent`", () => {
  assert.ok(guardRe.test("export async function requireLearnerConsent(req, ctx) {"));
});

test("does NOT match an unrelated export", () => {
  assert.equal(guardRe.test("export function hasLearnerConsent(req) {"), false);
  assert.equal(guardRe.test("export async function requireParentConsent(req) {"), false);
});
