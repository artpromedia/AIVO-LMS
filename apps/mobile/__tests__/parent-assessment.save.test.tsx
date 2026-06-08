/**
 * Pinned contract: submitting the parent assessment MUST POST to
 * assessment-svc `/api/assessments/parent` with the structured
 * functioning-level signals + free-text responses, and only resolve when
 * the server confirms a persisted row (no silent success — parity with
 * web-v2). The mobile wizard was previously local-state only and never
 * saved; a fake save fails this test because the mocked apiFetch is the
 * only path to the backend.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/constants/api", () => ({
  API: { ASSESSMENT: "https://assessment.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { submitParentAssessment } from "../hooks/useParentAssessment";

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const INPUT = {
  learnerId: "learner-7",
  communicationMode: "aac_device" as const,
  responseMethod: "touch_select" as const,
  deviceInteraction: "guided" as const,
  attentionSpan: "short" as const,
  additionalResponses: { goals: "confidence in reading" },
};

describe("submitParentAssessment (parent assessment save)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("POSTs the structured payload to assessment-svc and returns the row", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        assessment: { id: "pa-1", completedAt: "2026-06-08T00:00:00.000Z" },
        functioningLevel: { level: "SUPPORTED", confidence: 0.8 },
      }),
    );

    const result = await submitParentAssessment(INPUT);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://assessment.test");
    expect(path).toBe("/api/assessments/parent");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(INPUT);
    expect(result.assessment.id).toBe("pa-1");
  });

  it("throws the upstream error message on non-2xx", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));
    await expect(submitParentAssessment(INPUT)).rejects.toThrow("Forbidden");
  });

  it("no silent success: a 2xx without a persisted id is a failed save", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ assessment: {} }, 200));
    await expect(submitParentAssessment(INPUT)).rejects.toThrow(/did not save/i);
  });

  it("never silently swallows network failures", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(submitParentAssessment(INPUT)).rejects.toThrow("offline");
  });
});
