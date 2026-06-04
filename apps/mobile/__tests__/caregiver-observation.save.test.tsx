/**
 * Pinned contract: pressing Submit on the caregiver observation screen
 * MUST trigger a real `apiFetch` POST to `family-svc`'s
 * `/api/family/observations` endpoint with the learner's notes payload.
 *
 * Mirrors `therapist-notes.save.test.tsx`. A fake save (no apiFetch call)
 * fails the test because the mocked spy never fires.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/constants/api", () => ({
  API: { FAMILY: "https://family.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { createObservation } from "../hooks/useCreateObservation";

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createObservation (caregiver submit)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("POSTs the observation payload to family-svc /api/family/observations", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ id: "obs-1", notes: "Calm at lunch." }));

    await createObservation({
      learnerId: "learner-7",
      notes: "Calm at lunch, struggled at transition.",
      category: "behaviour",
      mood: "calm",
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/observations");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      learnerId: "learner-7",
      notes: "Calm at lunch, struggled at transition.",
      category: "behaviour",
      mood: "calm",
    });
  });

  it("throws the upstream error when family-svc rejects the submission", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "learnerId and notes required" }, 400),
    );

    await expect(createObservation({ learnerId: "learner-7", notes: "" })).rejects.toThrow(
      "learnerId and notes required",
    );
  });

  it("rethrows network failures rather than silently succeeding", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(createObservation({ learnerId: "learner-7", notes: "note" })).rejects.toThrow(
      "ECONNREFUSED",
    );
  });
});
