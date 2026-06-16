/**
 * Enrollment language → ai-svc delivery (web-v2 system-of-record path).
 *
 * web-v2 stores the learner's language at enrollment on its own
 * `web_learner_profiles` row and does NOT seed brain-svc, so the homework
 * tutor call is the ONLY place the language can reach ai-svc — it must ride
 * inside `brain_context.language_profile`. These tests pin that contract so a
 * future refactor can't silently drop the language and regress every
 * web-v2-enrolled learner back to English.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const callServiceMock = vi.fn();

vi.mock("@/lib/services/client", () => ({
  callService: (...args: unknown[]) => callServiceMock(...args),
}));

vi.mock("@/lib/env", () => ({
  serverEnv: {
    NODE_ENV: "test",
    AIVO_USE_AI_SVC: true,
    AIVO_USE_SERVICE_STACK: true,
    AI_SVC_URL: "http://ai-svc.test",
    INTERNAL_AI_TOKEN: "test-token",
  },
}));

import { generateGuidedReply } from "../tutor";

type CapturedBody = {
  brain_context: { language_profile?: { primary_language?: string } };
};

function lastBody(): CapturedBody {
  const call = callServiceMock.mock.calls.at(-1);
  if (!call) throw new Error("callService was not invoked");
  return (call[0] as { body: CapturedBody }).body;
}

afterEach(() => {
  callServiceMock.mockReset();
});

describe("generateGuidedReply — enrollment language forwarding", () => {
  it("forwards the learner's primaryLanguage into brain_context.language_profile", async () => {
    callServiceMock.mockResolvedValue({
      ok: true,
      data: { response: "¿Qué intentaste primero?", model: "test" },
    });

    const reply = await generateGuidedReply({
      topic: "fractions",
      subjectId: "math",
      turn: 0,
      learnerId: "learner-1",
      tenantId: "tenant-1",
      primaryLanguage: "Spanish",
    });

    expect(reply.text).toBe("¿Qué intentaste primero?");
    expect(lastBody().brain_context.language_profile).toEqual({
      primary_language: "Spanish",
    });
  });

  it("trims whitespace and accepts a raw locale code", async () => {
    callServiceMock.mockResolvedValue({
      ok: true,
      data: { response: "ok", model: "test" },
    });

    await generateGuidedReply({
      topic: "fractions",
      subjectId: "math",
      turn: 0,
      learnerId: "learner-1",
      tenantId: "tenant-1",
      primaryLanguage: "  es  ",
    });

    expect(lastBody().brain_context.language_profile).toEqual({
      primary_language: "es",
    });
  });

  it("omits language_profile when no language was captured at enrollment", async () => {
    callServiceMock.mockResolvedValue({
      ok: true,
      data: { response: "ok", model: "test" },
    });

    await generateGuidedReply({
      topic: "fractions",
      subjectId: "math",
      turn: 0,
      learnerId: "learner-1",
      tenantId: "tenant-1",
      primaryLanguage: null,
    });

    expect(lastBody().brain_context).not.toHaveProperty("language_profile");
  });

  it("treats a blank/whitespace language as absent (no English-clobbering empty profile)", async () => {
    callServiceMock.mockResolvedValue({
      ok: true,
      data: { response: "ok", model: "test" },
    });

    await generateGuidedReply({
      topic: "fractions",
      subjectId: "math",
      turn: 0,
      learnerId: "learner-1",
      tenantId: "tenant-1",
      primaryLanguage: "   ",
    });

    expect(lastBody().brain_context).not.toHaveProperty("language_profile");
  });
});
