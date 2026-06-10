/**
 * Contract test for the `useParentSummary` hook's pure fetcher.
 *
 * Verifies that:
 * - The correct family-svc endpoint is called with the parentId.
 * - Server-supplied trend arrays pass through unchanged when present.
 * - Client-side trend derivation fires when the server omits trends.
 * - Empty / missing history produces well-formed empty trend arrays.
 * - Non-2xx responses surface a meaningful error message.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchParentSummary } from "../hooks/useParentSummary";

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

const BASE_PAYLOAD = {
  parent: { name: "Jane Doe", lastDashboardVisit: "2026-06-01T10:00:00Z" },
  learners: [
    { id: "l1", firstName: "Alice", lastName: "Doe", gradeLevel: "3rd" },
    { id: "l2", firstName: "Bob", lastName: "Doe", gradeLevel: "5th" },
  ],
};

describe("fetchParentSummary", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("GETs /api/family/summary/:parentId and returns parent + learners", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ...BASE_PAYLOAD, activeTutors: 5, sessionsThisWeek: 12 }));

    const result = await fetchParentSummary("parent-1");

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/summary/parent-1");
    expect(result.parent?.name).toBe("Jane Doe");
    expect(result.learners).toHaveLength(2);
    expect(result.activeTutors).toBe(5);
    expect(result.sessionsThisWeek).toBe(12);
  });

  it("passes through server-supplied 7-day trend arrays when provided", async () => {
    const activeTutorsTrend = [4, 5, 5, 6, 6, 5, 7];
    const sessionsThisWeekTrend = [10, 11, 12, 11, 13, 12, 14];
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...BASE_PAYLOAD,
        activeTutors: 7,
        sessionsThisWeek: 14,
        activeTutorsTrend,
        sessionsThisWeekTrend,
      }),
    );

    const result = await fetchParentSummary("parent-2");

    expect(result.activeTutorsTrend).toEqual(activeTutorsTrend);
    expect(result.sessionsThisWeekTrend).toEqual(sessionsThisWeekTrend);
  });

  it("derives client-side trend when server omits trend arrays", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ ...BASE_PAYLOAD, activeTutors: 8, sessionsThisWeek: 20 }),
    );

    const result = await fetchParentSummary("parent-3");

    // Trend arrays must be 7 elements, last element equals current value.
    expect(result.activeTutorsTrend).toHaveLength(7);
    expect(result.activeTutorsTrend[6]).toBe(8);
    expect(result.sessionsThisWeekTrend).toHaveLength(7);
    expect(result.sessionsThisWeekTrend[6]).toBe(20);
    // Values must ramp up (oldest < newest)
    expect(result.activeTutorsTrend[0]).toBeLessThanOrEqual(result.activeTutorsTrend[6]);
  });

  it("returns empty trend arrays when current values are 0", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ ...BASE_PAYLOAD, activeTutors: 0, sessionsThisWeek: 0 }),
    );

    const result = await fetchParentSummary("parent-4");

    expect(result.activeTutorsTrend).toHaveLength(7);
    expect(result.activeTutorsTrend.every((v) => v === 0)).toBe(true);
    expect(result.sessionsThisWeekTrend.every((v) => v === 0)).toBe(true);
  });

  it("gracefully returns empty when the response has no learner data", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ parent: null, learners: [] }));

    const result = await fetchParentSummary("parent-5");

    expect(result.parent).toBeNull();
    expect(result.learners).toEqual([]);
    expect(result.activeTutors).toBe(0);
    expect(result.activeTutorsTrend).toHaveLength(7);
  });

  it("throws a meaningful error on a non-2xx response", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));

    await expect(fetchParentSummary("parent-6")).rejects.toThrow("Forbidden");
  });
});
