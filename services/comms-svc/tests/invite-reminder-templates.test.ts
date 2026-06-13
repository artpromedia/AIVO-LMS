/**
 * Sprint C-08 — contribution-nudge + invite-expiry-warning template rendering
 * (pure, no DB). Snapshots the warm, one-CTA copy and the opt-out link.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, AVAILABLE_TEMPLATES } from "../src/lib/templates.js";

test("contribution_nudge + invite_expiry_warning are registered templates", () => {
  assert.ok(AVAILABLE_TEMPLATES.some((t) => t.id === "contribution_nudge"));
  assert.ok(AVAILABLE_TEMPLATES.some((t) => t.id === "invite_expiry_warning"));
});

test("contribution_nudge renders warm one-CTA copy with the contribute link", () => {
  const r = renderTemplate("contribution_nudge", {
    kind: "teacher",
    learnerName: "Sky",
    inviterName: "The Rivera family",
    contributeUrl: "https://app.example/accept-invite?email=t%40x.com",
    unsubscribeUrl: "https://app.example/notifications/unsubscribe?kind=teacher&invite=i1",
  });
  // Subject is the persona-bar line: invitation + the 10-minute value prop.
  assert.match(r.subject, /Sky's family invited you/);
  assert.match(r.subject, /10 minutes/);
  // One CTA, pointing at the contribute (accept-invite) destination.
  assert.match(r.html, /Add my perspective/);
  assert.ok(r.html.includes("https://app.example/accept-invite?email=t%40x.com"));
  // No-pressure tone + opt-out honored via a real link.
  assert.match(r.html, /no pressure|No rush/i);
  assert.ok(r.html.includes("/notifications/unsubscribe?kind=teacher&invite=i1"));
  assert.match(r.text, /Add yours:/);
  assert.match(r.text, /stop these reminders/i);
});

test("contribution_nudge tailors the role word per kind", () => {
  assert.match(renderTemplate("contribution_nudge", { kind: "teacher" }).html, /classroom view/);
  assert.match(renderTemplate("contribution_nudge", { kind: "therapist" }).html, /clinical view/);
  assert.match(renderTemplate("contribution_nudge", { kind: "caregiver" }).html, /everyday view/);
});

test("contribution_nudge omits the opt-out clause when no unsubscribe url is given", () => {
  const r = renderTemplate("contribution_nudge", { kind: "teacher", learnerName: "Sky" });
  assert.ok(!/turn them off/i.test(r.html));
  assert.ok(!/stop these reminders/i.test(r.text));
});

test("invite_expiry_warning renders the countdown + accept CTA", () => {
  const r = renderTemplate("invite_expiry_warning", {
    learnerName: "Robin",
    teacherName: "Ms. Rivera",
    acceptUrl: "https://app.example/accept-invite?token=abc",
    hoursLeft: 6,
  });
  assert.match(r.subject, /Ms\. Rivera's invitation/);
  assert.match(r.subject, /expires in about 6 hours/);
  assert.match(r.html, /Accept before it expires/);
  assert.ok(r.html.includes("https://app.example/accept-invite?token=abc"));
  assert.match(r.text, /Robin/);
});

test("invite_expiry_warning wording: within the hour", () => {
  const r = renderTemplate("invite_expiry_warning", { teacherName: "Ms. Rivera", hoursLeft: 0 });
  assert.match(r.subject, /within the hour/);
});
