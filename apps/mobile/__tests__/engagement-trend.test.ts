/**
 * Contract test for the `useEngagementTrend` hook's pure fetcher.
 *
 * Verifies that:
 * - The correct engagement-svc endpoint is called with userId + days.
 * - Success path returns well-formed trend arrays.
 * - 404 (endpoint not yet deployed) degrades gracefully to empty arrays.
 * - Empty history arrays pass through as empty.
 * - Non-2xx (non-404) errors surface a meaningful message.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchEngagementTrend } from "../hooks/useEngagementTrend";

vi.mock("@/constants/api", () => ({
  API: { ENGAGEMENT: "https://engagement.test" },
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

describe("fetchEngagementTrend", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("GETs /api/engagement/trend/:userId?days=N and returns trend arrays", async () => {
    const xpTrend = [10, 15, 20, 12, 25, 18, 22];
    const streakTrend = [3, 3, 4, 4, 5, 5, 5];
    const focusTrend = [20, 25, 30, 22, 35, 28, 32];

    apiFetchMock.mockResolvedValueOnce(jsonResponse({ xpTrend, streakTrend, focusTrend }));

    const result = await fetchEngagementTrend("user-1", 7);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://engagement.test");
    expect(path).toBe("/api/engagement/trend/user-1?days=7");
    expect(result.xpTrend).toEqual(xpTrend);
    expect(result.streakTrend).toEqual(streakTrend);
    expect(result.focusTrend).toEqual(focusTrend);
  });

  it("forwards the days selector (30) to the URL", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ xpTrend: new Array(30).fill(5), streakTrend: [], focusTrend: [] }),
    );

    await fetchEngagementTrend("user-2", 30);

    const [, path] = apiFetchMock.mock.calls[0];
    expect(path).toBe("/api/engagement/trend/user-2?days=30");
  });

  it("degrades gracefully to empty arrays on 404 (endpoint not deployed)", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Not Found" }, 404));

    const result = await fetchEngagementTrend("user-3", 7);

    expect(result.xpTrend).toEqual([]);
    expect(result.streakTrend).toEqual([]);
    expect(result.focusTrend).toEqual([]);
  });

  it("returns empty arrays when server sends empty history", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ xpTrend: [], streakTrend: [], focusTrend: [] }),
    );

    const result = await fetchEngagementTrend("user-4", 7);

    expect(result.xpTrend).toEqual([]);
    expect(result.streakTrend).toEqual([]);
    expect(result.focusTrend).toEqual([]);
  });

  it("normalises missing trend fields to empty arrays", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ xpTrend: [5, 10] }));

    const result = await fetchEngagementTrend("user-5", 7);

    expect(result.xpTrend).toEqual([5, 10]);
    expect(result.streakTrend).toEqual([]);
    expect(result.focusTrend).toEqual([]);
  });

  it("throws a meaningful error on a non-404 error response", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Internal Server Error" }, 500));

    await expect(fetchEngagementTrend("user-6", 7)).rejects.toThrow("Internal Server Error");
  });
});
