/**
 * trial_ending template rendering (pure, no DB).
 */
import { test } from "node:test";
import assert from "node:assert";
import { renderTemplate, AVAILABLE_TEMPLATES } from "../src/lib/templates.js";

test("trial_ending is a registered template", () => {
  assert.ok(AVAILABLE_TEMPLATES.some((t) => t.id === "trial_ending"));
});

test("trial_ending renders subject/html/text with the renewal link", () => {
  const r = renderTemplate("trial_ending", {
    name: "Ada",
    trialEndDate: "2026-06-12",
    daysLeft: 3,
    renewalUrl: "https://app.aivolearning.com/parent/settings/billing",
  });
  assert.match(r.subject, /trial ends/i);
  assert.match(r.subject, /in 3 days/);
  assert.ok(r.html.includes("Ada"));
  assert.ok(r.html.includes("https://app.aivolearning.com/parent/settings/billing"));
  assert.ok(r.text.includes("2026-06-12"));
});

test("trial_ending day wording: today / tomorrow", () => {
  assert.match(renderTemplate("trial_ending", { daysLeft: 0 }).subject, /today/);
  assert.match(renderTemplate("trial_ending", { daysLeft: 1 }).subject, /tomorrow/);
});
