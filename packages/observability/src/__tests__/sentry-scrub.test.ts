import { describe, expect, it } from "vitest";
import { scrubSentryEvent, __scrubInternals } from "../sentry-scrub";

describe("scrubSentryEvent — the COPPA boundary", () => {
  it("hashes the user id and drops every other user field", () => {
    const event = scrubSentryEvent({
      user: {
        id: "u_parent_1",
        email: "parent@example.com",
        username: "Riley Parent",
        ip_address: "10.0.0.1",
      },
    });
    expect(event.user?.id).toMatch(/^anon_/);
    expect(event.user?.id).not.toContain("u_parent_1");
    expect(event.user?.email).toBeUndefined();
    expect(event.user?.username).toBeUndefined();
    expect(event.user?.ip_address).toBeUndefined();
  });

  it("is stable per user so events still correlate", () => {
    const a = scrubSentryEvent({ user: { id: "u_1" } });
    const b = scrubSentryEvent({ user: { id: "u_1" } });
    const c = scrubSentryEvent({ user: { id: "u_2" } });
    expect(a.user?.id).toBe(b.user?.id);
    expect(a.user?.id).not.toBe(c.user?.id);
  });

  it("drops request cookies and bodies, redacts auth headers", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.aivolearning.com/api/bff/x",
        cookies: { aivo_session: "secret" },
        data: { learnerNote: "free text" },
        headers: { cookie: "aivo_session=secret", accept: "application/json" },
      },
    });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.headers?.cookie).toBe("[scrubbed]");
    expect(event.request?.headers?.accept).toBe("application/json");
    expect(event.request?.url).toContain("/api/bff/x");
  });

  it("redacts learner/medical/PII-shaped keys in contexts, extra, tags, breadcrumbs", () => {
    const event = scrubSentryEvent({
      contexts: {
        lesson: { learnerId: "lrn_demo_sky", beat: 3 },
        flow: { iepText: "confidential", step: "review" },
      },
      extra: { email: "kid@example.com", retries: 2 },
      tags: { learner_id: "lrn_demo_sky", surface: "stage" },
      breadcrumbs: [{ message: "click", data: { displayName: "Sky", x: 1 } }],
    });
    const lesson = event.contexts?.lesson as Record<string, unknown>;
    const flow = event.contexts?.flow as Record<string, unknown>;
    expect(lesson.learnerId).toBe("[scrubbed]");
    expect(lesson.beat).toBe(3);
    expect(flow.iepText).toBe("[scrubbed]");
    expect(flow.step).toBe("review");
    expect(event.extra?.email).toBe("[scrubbed]");
    expect(event.extra?.retries).toBe(2);
    expect(event.tags?.learner_id).toBe("[scrubbed]");
    expect(event.tags?.surface).toBe("stage");
    expect(event.breadcrumbs?.[0]?.data).toEqual({ displayName: "[scrubbed]", x: 1 });
  });

  it("never returns null — scrubbed events still deliver", () => {
    expect(scrubSentryEvent({})).toBeTruthy();
  });

  it("key matcher catches the documented sensitive families", () => {
    const { isSensitiveKey } = __scrubInternals;
    for (const key of [
      "learnerId",
      "learner_ids",
      "email",
      "displayName",
      "iep_text",
      "medicalNotes",
      "birthDate",
      "dob",
      "Authorization",
      "session_token",
    ]) {
      expect(isSensitiveKey(key), key).toBe(true);
    }
    for (const key of ["surface", "step", "retries", "route", "status"]) {
      expect(isSensitiveKey(key), key).toBe(false);
    }
  });
});
