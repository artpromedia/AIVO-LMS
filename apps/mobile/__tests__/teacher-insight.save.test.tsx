/**
 * Pinned contract: pressing Submit on the teacher insight screen MUST
 * trigger a real `apiFetch` POST to `family-svc`'s
 * `/api/family/teacher-insights` endpoint with the insight text payload.
 *
 * The family-svc handler persists into the dedicated `teacher_insights`
 * table and mirrors into `brain_insights` — but that's the backend's job;
 * the mobile contract is simply that the network call happens at all.
 * A fake save fails this test because the mocked apiFetch is the only
 * thing the fetcher uses to talk to the backend.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import { createTeacherInsight } from "../hooks/useCreateTeacherInsight";

vi.mock("@/constants/api", () => ({
  API: { FAMILY: "https://family.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createTeacherInsight (teacher insight submit)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("POSTs the insight payload to family-svc /api/family/teacher-insights", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ insight: { id: "ti-1", insightText: "Strong with visual fractions." } }),
    );

    const result = await createTeacherInsight({
      learnerId: "learner-11",
      insightText: "Strong with visual fractions.",
      domain: "math",
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/teacher-insights");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      learnerId: "learner-11",
      insightText: "Strong with visual fractions.",
      domain: "math",
    });
    expect(result.insight).toMatchObject({ id: "ti-1" });
  });

  it("throws the upstream error message on non-2xx", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));
    await expect(
      createTeacherInsight({ learnerId: "learner-11", insightText: "x" }),
    ).rejects.toThrow("Forbidden");
  });

  it("never silently swallows network failures", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(
      createTeacherInsight({ learnerId: "learner-11", insightText: "x" }),
    ).rejects.toThrow("offline");
  });
});
