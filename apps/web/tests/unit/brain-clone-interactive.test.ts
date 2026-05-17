/**
 * Unit tests for the pure helpers behind `BrainCloneInteractive`. Run
 * under `tsx --test` via `pnpm --filter web test`.
 *
 * These cover the data-shape contracts that, if broken, would silently
 * mis-colour the parent dashboard's brain regions or report misleading
 * grade-equivalent numbers — the kind of regression a typed compile
 * won't catch but parents would notice immediately.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  domainToSlot,
  formatGrade,
  gradeToNumber,
  pulseSecondsFor,
  statusFor,
} from "../../src/components/brain/BrainCloneInteractive.helpers.js";

test("gradeToNumber handles K/PK and numeric forms", () => {
  assert.equal(gradeToNumber("K"), 0);
  assert.equal(gradeToNumber("Kindergarten"), 0);
  assert.equal(gradeToNumber("PK"), 0);
  assert.equal(gradeToNumber("Pre-K"), 0);
  assert.equal(gradeToNumber("3"), 3);
  assert.equal(gradeToNumber("10th grade"), 10);
  assert.equal(gradeToNumber("Grade 7"), 7);
  assert.equal(gradeToNumber(8), 8);
});

test("gradeToNumber falls back to a sane default", () => {
  // Null/undefined and unparseable values fall back to 6, NOT 0, so a
  // missing grade doesn't make every learner look like a kindergartner.
  assert.equal(gradeToNumber(null), 6);
  assert.equal(gradeToNumber(undefined), 6);
  assert.equal(gradeToNumber("???"), 6);
  assert.equal(gradeToNumber(""), 6);
});

test("statusFor returns 'unknown' band when there is no mastery data", () => {
  const s = statusFor(0, 5);
  assert.equal(s.band, "unknown");
  assert.match(s.description, /Complete a learning session/);
});

test("statusFor classifies on-or-above-grade as 'strong'", () => {
  // Mastery 1.0 against grade 5 → equivalent = 5.0 → gap = 0 → strong.
  assert.equal(statusFor(1.0, 5).band, "strong");
  // A small overshoot still counts as strong.
  assert.equal(statusFor(0.99, 5).band, "strong");
});

test("statusFor classifies a slight lag as 'approaching'", () => {
  // Mastery 0.85 against grade 5 → equivalent = 4.25 → gap = 0.75 yrs.
  assert.equal(statusFor(0.85, 5).band, "approaching");
});

test("statusFor classifies a >1.5yr gap as 'gap'", () => {
  // Mastery 0.5 against grade 5 → equivalent = 2.5 → gap = 2.5 yrs.
  const s = statusFor(0.5, 5);
  assert.equal(s.band, "gap");
  assert.match(s.description, /Tutors are calibrated/);
});

test("statusFor does not divide by zero on K (enrolled = 0)", () => {
  // Enrolled 0 (Kindergarten) used to crash the gap math. Should still
  // produce a stable status object.
  const s = statusFor(0.6, 0);
  assert.ok(["strong", "approaching", "gap"].includes(s.band));
});

test("pulseSecondsFor scales with mastery within the safe range", () => {
  // Inverse relationship — strong mastery pulses faster (smaller seconds).
  const strong = pulseSecondsFor(1.0);
  const weak = pulseSecondsFor(0.1);
  assert.ok(strong < weak);
  // Never faster than 1.6 s — anything tighter would feel anxious.
  assert.ok(strong >= 1.6 - 1e-9);
  // Never slower than 4.0 s for any positive mastery.
  assert.ok(weak <= 4.0 + 1e-9);
  // No-data → no pulse.
  assert.equal(pulseSecondsFor(0), 0);
  assert.equal(pulseSecondsFor(NaN), 0);
});

test("domainToSlot maps the canonical 6 domains", () => {
  assert.equal(domainToSlot("math"), "parietal");
  assert.equal(domainToSlot("Mathematics"), "parietal");
  assert.equal(domainToSlot("ela"), "temporal");
  assert.equal(domainToSlot("Reading"), "temporal");
  assert.equal(domainToSlot("science"), "frontal-occipital");
  assert.equal(domainToSlot("sel"), "limbic");
  assert.equal(domainToSlot("speech"), "speech");
  assert.equal(domainToSlot("Executive Function"), "prefrontal");
  assert.equal(domainToSlot("executive_function"), "prefrontal");
});

test("domainToSlot returns null for unknown domains so the caller can fall back", () => {
  assert.equal(domainToSlot("art"), null);
  assert.equal(domainToSlot(""), null);
});

test("formatGrade renders Kindergarten as 'K' rather than '0'", () => {
  // The "strong" status copy embeds the enrolled grade. K = 0 internally,
  // but parents read "K" — never "0" — so formatGrade is the canonical
  // way to surface enrolled.
  assert.equal(formatGrade(0), "K");
  assert.equal(formatGrade(-1), "K");
  assert.equal(formatGrade(3), "3");
  assert.equal(formatGrade(10), "10");
  assert.equal(formatGrade(NaN), "—");
});

test("statusFor descriptions render Kindergarten as 'K' for enrolled-grade copy", () => {
  // Mastery 1.0, enrolled 0 (K) → on-grade band → description must
  // contain "enrolled grade of K", not "enrolled grade of 0".
  const s = statusFor(1.0, 0);
  assert.equal(s.band, "strong");
  assert.match(s.description, /enrolled grade of K/);
});
