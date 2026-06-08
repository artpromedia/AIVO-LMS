/**
 * Pinned contract: the caregiver observations feed reads real family-svc
 * data via `apiFetch` GET `/api/family/observations?learnerId=…` and
 * unwraps the `{ observations }` envelope. A fake read (no apiFetch call)
 * fails because the mocked spy never fires.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import { fetchObservations } from "../src/api/observations";

vi.mock("@/constants/api", () => ({
  API: { FAMILY: "https://family.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchObservations (caregiver feed)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("GETs the learner-scoped observations endpoint and unwraps the envelope", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        observations: [
          { id: "o1", learnerId: "learner-7", category: "General", notes: "Calm", date: "2026-06-01" },
        ],
      }),
    );

    const rows = await fetchObservations("learner-7");

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/observations?learnerId=learner-7");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "o1", notes: "Calm" });
  });

  it("tolerates a bare array response", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: "o2", learnerId: "l", category: "General", notes: "n", date: "x" }]),
    );
    const rows = await fetchObservations("l");
    expect(rows).toHaveLength(1);
  });

  it("short-circuits without a learnerId (no network call)", async () => {
    const rows = await fetchObservations("");
    expect(rows).toEqual([]);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("throws the upstream error rather than silently returning empty", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Access denied" }, 403));
    await expect(fetchObservations("learner-7")).rejects.toThrow("Access denied");
  });

  it("rethrows network failures", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(fetchObservations("learner-7")).rejects.toThrow("ECONNREFUSED");
  });
});
