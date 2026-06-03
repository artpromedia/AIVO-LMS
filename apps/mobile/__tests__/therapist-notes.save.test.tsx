/**
 * Pinned contract: pressing Save on the therapist session-notes screen
 * MUST trigger a real `apiFetch` POST to `family-svc`'s
 * `/api/family/therapy-sessions` endpoint with the SOAP-style note body.
 *
 * Why this test exists: an earlier revision faked a successful save via
 * `Alert.alert("Saved")` and discarded the clinician's note. The fetcher
 * is exported separately from the React Query wrapper so this test can
 * exercise it without rendering the React Native tree — if anyone later
 * removes the network call, the spy never fires and the test fails.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/constants/api", () => ({
  API: { FAMILY: "https://family.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { createTherapySession } from "../hooks/useCreateTherapySession";

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createTherapySession (therapist notes save)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("POSTs the SOAP note payload to family-svc /api/family/therapy-sessions", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ session: { id: "tx-1" } }));

    const result = await createTherapySession({
      learnerId: "learner-42",
      outcome: "Held attention for full 20-min block.",
      skillTargeted: "Receptive language",
      method: "Play-based therapy",
      recommendations: "Continue weekly sessions.",
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/therapy-sessions");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({
      learnerId: "learner-42",
      outcome: "Held attention for full 20-min block.",
      skillTargeted: "Receptive language",
      method: "Play-based therapy",
      recommendations: "Continue weekly sessions.",
    });
    expect(result).toEqual({ session: { id: "tx-1" } });
  });

  it("throws with the upstream error message when family-svc returns a non-2xx", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));

    await expect(
      createTherapySession({ learnerId: "learner-42", outcome: "note" }),
    ).rejects.toThrow("Forbidden");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("never silently succeeds — an unhandled fetch failure propagates", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(
      createTherapySession({ learnerId: "learner-42", outcome: "note" }),
    ).rejects.toThrow("network down");
  });
});
