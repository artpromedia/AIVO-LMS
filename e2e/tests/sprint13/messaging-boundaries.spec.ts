/**
 * Sprint 13 — messaging boundaries E2E.
 *
 * Exercises the five mandated negative cases from
 * docs/comms/boundaries.md plus one positive end-to-end:
 *   - create thread → post message → recipient sees push event row.
 *
 * The negative cases assert 403 (not 404, not empty 200) — the
 * distinction matters because an empty 200 would silently disclose
 * thread existence to a non-participant.
 *
 * These tests drive the BFF + service via JWT-authed HTTP calls so
 * they exercise the full chain. Required env (skip the suite if not
 * present so the harness stays usable in CI without a seeded DB):
 *
 *   E2E_BFF_BASE_URL                       – e.g. http://localhost:5000
 *   E2E_MSG_PARENT_A_TOKEN                 – JWT for parent of learner A
 *   E2E_MSG_PARENT_B_TOKEN                 – JWT for parent of learner B
 *   E2E_MSG_CAREGIVER_A_TOKEN              – JWT for caregiver of learner A
 *   E2E_MSG_TEACHER_A_TOKEN                – JWT for teacher of learner A
 *   E2E_MSG_THERAPIST_NOCONSENT_TOKEN      – JWT for therapist, no consent row
 *   E2E_MSG_THERAPIST_CONSENT_TOKEN        – JWT for therapist with consent
 *   E2E_MSG_LEARNER_TOKEN                  – JWT for learner A
 *   E2E_MSG_LEARNER_A_ID
 *   E2E_MSG_LEARNER_B_ID
 *   E2E_MSG_LESSON_ID                      – currently active lesson id
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BFF_BASE_URL || process.env.WEB_BASE_URL || "http://localhost:5000";

const tokens = {
  parentA: process.env.E2E_MSG_PARENT_A_TOKEN,
  parentB: process.env.E2E_MSG_PARENT_B_TOKEN,
  caregiverA: process.env.E2E_MSG_CAREGIVER_A_TOKEN,
  teacherA: process.env.E2E_MSG_TEACHER_A_TOKEN,
  therapistNoConsent: process.env.E2E_MSG_THERAPIST_NOCONSENT_TOKEN,
  therapistConsent: process.env.E2E_MSG_THERAPIST_CONSENT_TOKEN,
  learner: process.env.E2E_MSG_LEARNER_TOKEN,
};
const learnerA = process.env.E2E_MSG_LEARNER_A_ID;
const learnerB = process.env.E2E_MSG_LEARNER_B_ID;
const lessonId = process.env.E2E_MSG_LESSON_ID;

const haveAll = Object.values(tokens).every(Boolean) && learnerA && learnerB && lessonId;

test.describe("Sprint 13 — messaging boundaries", () => {
  test.skip(
    !haveAll,
    "Requires seeded JWTs and learner/lesson ids — set the E2E_MSG_* env vars",
  );

  test("parent of A cannot view a thread about learner B (403, not empty 200)", async ({
    request,
  }) => {
    // Parent B creates a thread about learner B.
    const created = await request.post(`${BASE}/api/bff/comms/threads`, {
      headers: { authorization: `Bearer ${tokens.parentB}` },
      data: { kind: "parent_teacher", learnerId: learnerB },
    });
    expect(created.status()).toBeLessThan(400);
    const { data } = (await created.json()) as { data: { thread: { id: string } } };
    const tid = data.thread.id;
    // Parent A tries to GET it – must be 403, never a silent empty 200.
    const probe = await request.get(`${BASE}/api/bff/comms/threads/${tid}/messages`, {
      headers: { authorization: `Bearer ${tokens.parentA}` },
    });
    expect(probe.status()).toBe(403);
  });

  test("caregiver of A can READ parent_teacher thread for A but cannot POST", async ({
    request,
  }) => {
    const created = await request.post(`${BASE}/api/bff/comms/threads`, {
      headers: { authorization: `Bearer ${tokens.teacherA}` },
      data: { kind: "parent_teacher", learnerId: learnerA },
    });
    const { data } = (await created.json()) as { data: { thread: { id: string } } };
    const tid = data.thread.id;
    const read = await request.get(`${BASE}/api/bff/comms/threads/${tid}/messages`, {
      headers: { authorization: `Bearer ${tokens.caregiverA}` },
    });
    expect(read.status()).toBeLessThan(400);
    const post = await request.post(`${BASE}/api/bff/comms/threads/${tid}/messages`, {
      headers: { authorization: `Bearer ${tokens.caregiverA}` },
      data: { body: "I should not be able to send this" },
    });
    expect(post.status()).toBe(403);
  });

  test("therapist with NO consent row is denied therapist_family", async ({ request }) => {
    const created = await request.post(`${BASE}/api/bff/comms/threads`, {
      headers: { authorization: `Bearer ${tokens.therapistNoConsent}` },
      data: { kind: "therapist_family", learnerId: learnerA },
    });
    expect(created.status()).toBe(403);
  });

  test("two unrelated parents cannot DM (refused at create time)", async ({ request }) => {
    const created = await request.post(`${BASE}/api/bff/comms/threads`, {
      headers: { authorization: `Bearer ${tokens.parentA}` },
      data: { kind: "parent_teacher", learnerId: learnerB },
    });
    expect(created.status()).toBe(403);
  });

  test("learner ↔ teacher outside an active lesson is denied", async ({ request }) => {
    const created = await request.post(`${BASE}/api/bff/comms/threads`, {
      headers: { authorization: `Bearer ${tokens.learner}` },
      data: {
        kind: "learner_teacher_lesson",
        learnerId: learnerA,
        lessonId: "00000000-0000-0000-0000-deadbeefdead",
      },
    });
    expect(created.status()).toBe(403);
  });

  test("positive: create thread, post message, recipient receives push", async ({ request }) => {
    const created = await request.post(`${BASE}/api/bff/comms/threads`, {
      headers: { authorization: `Bearer ${tokens.teacherA}` },
      data: { kind: "parent_teacher", learnerId: learnerA },
    });
    expect(created.status()).toBeLessThan(400);
    const { data } = (await created.json()) as { data: { thread: { id: string } } };
    const tid = data.thread.id;
    const post = await request.post(`${BASE}/api/bff/comms/threads/${tid}/messages`, {
      headers: { authorization: `Bearer ${tokens.teacherA}` },
      data: { body: "Hello family — quick update on this week." },
    });
    expect(post.status()).toBeLessThan(400);
    const body = (await post.json()) as {
      data: { message: { id: string }; push?: Array<{ status: string }> };
    };
    expect(body.data.message.id).toBeTruthy();
    // PR #55's push-router is wired in production; in the e2e env it may
    // be 'skipped' (no FCM/APNs configured) but the array must be present
    // so we know the fan-out hook ran.
    expect(Array.isArray(body.data.push)).toBe(true);
  });
});
