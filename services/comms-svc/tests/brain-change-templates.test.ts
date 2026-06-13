/**
 * Sprint C-13 — brain-profile notification template rendering (pure, no DB).
 * Snapshots the warm, one-CTA, jargon-free copy and the opt-out link for the
 * SCREEN 0 ready email, the structural-change notice, and the digest reminder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, AVAILABLE_TEMPLATES } from "../src/lib/templates.js";

test("the three brain templates are registered", () => {
  for (const id of ["brain_profile_ready", "brain_profile_changed", "brain_changes_reminder"]) {
    assert.ok(AVAILABLE_TEMPLATES.some((t) => t.id === id), `${id} missing from registry`);
  }
});

test("brain_profile_ready renders SCREEN 0 copy intent + the review CTA", () => {
  const r = renderTemplate("brain_profile_ready", {
    learnerName: "Maya",
    reviewUrl: "https://app.example/parent/learners/lr1/brain-clone-watch",
    unsubscribeUrl: "https://app.example/notifications",
  });
  // §4.2 copy intent: finished Discovery Adventure + drafted profile waiting.
  assert.match(r.html, /finished their Discovery Adventure/);
  assert.match(r.html, /drafted Maya's learning profile/);
  // CTA "See what we learned".
  assert.match(r.html, /See what we learned/);
  assert.ok(r.html.includes("/brain-clone-watch"));
  // No-deadline reassurance + opt-out honored.
  assert.match(r.html, /no deadline/i);
  assert.ok(r.html.includes("https://app.example/notifications"));
  assert.match(r.text, /See what we learned:/);
});

test("brain_profile_changed leads with the delta summary + a single review CTA", () => {
  const r = renderTemplate("brain_profile_changed", {
    learnerName: "Maya",
    summary: "Read-aloud is now on after her last 3 reading sessions.",
    reviewUrl: "https://app.example/parent/learners/lr1/brain-timeline",
  });
  assert.match(r.html, /Read-aloud is now on/);
  // Honest + non-blocking: lessons carry on.
  assert.match(r.html, /carrying on as usual/i);
  assert.match(r.html, /See what changed/);
  assert.ok(r.html.includes("/brain-timeline"));
  assert.match(r.text, /Read-aloud is now on/);
});

test("brain_changes_reminder is gentle, singular/plural aware, one CTA", () => {
  const one = renderTemplate("brain_changes_reminder", {
    learnerName: "Maya",
    count: 1,
    reviewUrl: "https://app.example/t",
  });
  assert.match(one.subject, /An update to Maya's profile/);
  assert.match(one.html, /nothing is paused|Nothing is paused/i);
  assert.match(one.html, /Review what changed/);
  // One-reminder honesty.
  assert.match(one.html, /only reminder/i);

  const many = renderTemplate("brain_changes_reminder", { learnerName: "Maya", count: 3, reviewUrl: "#" });
  assert.match(many.subject, /3 updates to Maya's profile/);
});

test("brain templates omit the opt-out clause when no unsubscribe url is given", () => {
  const r = renderTemplate("brain_profile_ready", { learnerName: "Maya", reviewUrl: "#" });
  assert.ok(!/turn them off/i.test(r.html));
  assert.ok(!/To stop these emails/i.test(r.text));
});
