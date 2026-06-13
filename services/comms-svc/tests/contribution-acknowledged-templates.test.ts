/**
 * Sprint C-16 — the contributor "your input shaped X" acknowledgement templates
 * (role-aware, pure render). Proves the warm one-CTA copy, the role wording,
 * AND — the sprint's central trust rule — the PRIVACY content-safety surface:
 * the template names ONLY the learner first name + the contributor's OWN folded
 * items (label + their reasoning), escapes the user-authored snippet, and never
 * surfaces levels/diagnoses, another contributor's content, or parent-private
 * data.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { renderTemplate, AVAILABLE_TEMPLATES } from "../src/lib/templates.js";
import { registerNotificationRoutes } from "../src/routes/notifications.js";

const ROLES = ["teacher", "caregiver", "therapist"] as const;
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || "aivo-internal-dev-key";

test("all three role-aware acknowledgement templates are registered", () => {
  for (const role of ROLES) {
    assert.ok(
      AVAILABLE_TEMPLATES.some((t) => t.id === `contribution_acknowledged_${role}`),
      `missing template contribution_acknowledged_${role}`,
    );
  }
});

test("renders warm one-CTA copy naming the contributor's own folded support", () => {
  const r = renderTemplate("contribution_acknowledged_therapist", {
    learnerFirstName: "Maya",
    items: [
      {
        label: "AAC / communication support",
        reasoning: "therapist insight (communication): Maya uses a speech device.",
      },
    ],
    contributionsUrl: "https://app.example/therapist/home",
    unsubscribeUrl: "https://app.example/notifications",
  });
  assert.match(r.subject, /Your input shaped Maya's learning plan/);
  // The headline names the contributor's own folded support + the first name.
  assert.match(r.html, /AAC \/ communication support/);
  assert.match(r.html, /Maya/);
  // Exactly one CTA, to the contributor's own surface.
  assert.ok(r.html.includes("https://app.example/therapist/home"));
  assert.match(r.html, /See your contributions/);
  // Opt-out honored via a real link.
  assert.ok(r.html.includes("https://app.example/notifications"));
  // Gratitude without flattery.
  assert.match(r.html, /Thank you/);
});

test("role wording differs (clinical note / classroom note / observation)", () => {
  const base = {
    learnerFirstName: "Sky",
    items: [{ label: "Read-aloud", reasoning: "prefers passages read aloud." }],
    contributionsUrl: "#",
    unsubscribeUrl: "#",
  };
  assert.match(renderTemplate("contribution_acknowledged_therapist", base).html, /clinical note/);
  assert.match(renderTemplate("contribution_acknowledged_teacher", base).html, /classroom note/);
  assert.match(renderTemplate("contribution_acknowledged_caregiver", base).html, /observation/);
});

test("PRIVACY: never surfaces levels / diagnoses / mastery (content-safety)", () => {
  // Even if the caller were to (wrongly) pass extra fields, the renderer only
  // reads learnerFirstName + items[].label/reasoning — nothing else can leak.
  const r = renderTemplate("contribution_acknowledged_teacher", {
    learnerFirstName: "Maya",
    items: [{ label: "Read-aloud", reasoning: "prefers passages read aloud." }],
    // hostile extras that MUST be ignored by the renderer:
    functioningLevel: "LOW_VERBAL",
    diagnoses: ["autism"],
    masteryLevels: { math: 0.3 },
    otherContributorNote: "the therapist said she uses a speech device",
    contributionsUrl: "#",
    unsubscribeUrl: "#",
  } as Record<string, unknown>);
  const blob = `${r.subject}\n${r.html}\n${r.text}`.toLowerCase();
  assert.ok(!blob.includes("low_verbal"), "must not surface functioning level");
  assert.ok(!blob.includes("autism"), "must not surface a diagnosis");
  assert.ok(!blob.includes("0.3"), "must not surface a mastery score");
  assert.ok(!blob.includes("speech device"), "must not surface another contributor's content");
});

test("PRIVACY: escapes a user-authored reasoning snippet (no HTML injection)", () => {
  const r = renderTemplate("contribution_acknowledged_caregiver", {
    learnerFirstName: "Sky",
    items: [
      {
        label: "Sensory breaks",
        reasoning: "<script>alert('x')</script> needs <b>quiet</b> & calm",
      },
    ],
    contributionsUrl: "#",
    unsubscribeUrl: "#",
  });
  // The raw script/markup must be escaped in the HTML body.
  assert.ok(!r.html.includes("<script>"), "script tag must be escaped");
  assert.ok(r.html.includes("&lt;script&gt;"), "snippet must be HTML-escaped");
  assert.ok(r.html.includes("&amp;"), "ampersand must be escaped");
});

test("renders a graceful body when no items are present", () => {
  const r = renderTemplate("contribution_acknowledged_teacher", {
    learnerFirstName: "Maya",
    items: [],
    contributionsUrl: "#",
    unsubscribeUrl: "#",
  });
  assert.match(r.html, /now part of Maya's (approved learning )?plan/);
  assert.match(r.html, /See your contributions/);
});

// ─── the internal delivery route (auth + role validation) ───────────────────

async function buildApp() {
  const app = Fastify({ logger: false });
  // The route doesn't touch the db for this path (renders + sends), so a stub is fine.
  registerNotificationRoutes(app, {} as unknown);
  return app;
}

test("internal route rejects a missing / wrong internal key (401)", async () => {
  const app = await buildApp();
  const noKey = await app.inject({
    method: "POST",
    url: "/api/comms/internal/contribution-acknowledged",
    payload: { to: "a@x.io", role: "teacher" },
  });
  assert.equal(noKey.statusCode, 401);
  const wrong = await app.inject({
    method: "POST",
    url: "/api/comms/internal/contribution-acknowledged",
    headers: { "x-internal-key": "wrong" },
    payload: { to: "a@x.io", role: "teacher" },
  });
  assert.equal(wrong.statusCode, 401);
  await app.close();
});

test("internal route requires a valid role", async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/internal/contribution-acknowledged",
    headers: { "x-internal-key": INTERNAL_KEY },
    payload: { to: "a@x.io", role: "parent" },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("internal route accepts a valid role payload (dev_mode when email unconfigured)", async () => {
  const app = await buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/internal/contribution-acknowledged",
    headers: { "x-internal-key": INTERNAL_KEY },
    payload: {
      to: "ot@clinic.example",
      role: "therapist",
      learnerFirstName: "Maya",
      items: [{ label: "AAC / communication support", reasoning: "uses a speech device." }],
      contributionsUrl: "https://app.example/therapist/home",
      unsubscribeUrl: "https://app.example/notifications",
    },
  });
  // Email is not configured in the test env → the route reports dev_mode (it
  // resolved the role, rendered the template, and did not error).
  assert.equal(res.statusCode, 200);
  const body = res.json() as { status: string };
  assert.ok(["dev_mode", "sent", "queued"].includes(body.status));
  await app.close();
});
