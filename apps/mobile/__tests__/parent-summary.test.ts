/**
 * Contract test for the `useParentSummary` hook's pure fetcher.
 *
 * Verifies that:
 * - The correct family-svc endpoint is called with the parentId.
 * - The real nested `summary { activeTutors, sessionsThisWeek }` shape is
 *   parsed, with future flat-field support.
 * - Server-supplied trend arrays pass through unchanged when present.
 * - Omitted trends produce EMPTY arrays — no client-side fabrication.
 * - Non-2xx responses surface a meaningful error message.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { fetchParentSummary, parentSummaryQueryOptions } from "../hooks/useParentSummary";

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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

  it("GETs /api/family/summary/:parentId and parses the nested summary shape", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...BASE_PAYLOAD,
        summary: { activeTutors: 3, sessionsThisWeek: 5 },
      }),
    );

    const result = await fetchParentSummary("parent-1");

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/summary/parent-1");
    expect(init).toBeUndefined();
    expect(result.parent?.name).toBe("Jane Doe");
    expect(result.learners).toHaveLength(2);
    expect(result.summary).toEqual({ activeTutors: 3, sessionsThisWeek: 5 });
    expect(result.activeTutors).toBe(3);
    expect(result.sessionsThisWeek).toBe(5);
  });

  it("supports future flat-field responses", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ ...BASE_PAYLOAD, activeTutors: 5, sessionsThisWeek: 12 }),
    );

    const result = await fetchParentSummary("parent-flat");

    expect(result.activeTutors).toBe(5);
    expect(result.sessionsThisWeek).toBe(12);
    expect(result.summary).toEqual({ activeTutors: 5, sessionsThisWeek: 12 });
  });

  it("passes through server-supplied trend arrays when provided", async () => {
    const activeTutorsTrend = [4, 5, 5, 6, 6, 5, 7];
    const sessionsThisWeekTrend = [10, 11, 12, 11, 13, 12, 14];
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...BASE_PAYLOAD,
        summary: { activeTutors: 7, sessionsThisWeek: 14 },
        activeTutorsTrend,
        sessionsThisWeekTrend,
      }),
    );

    const result = await fetchParentSummary("parent-2");

    expect(result.activeTutorsTrend).toEqual(activeTutorsTrend);
    expect(result.sessionsThisWeekTrend).toEqual(sessionsThisWeekTrend);
  });

  it("returns EMPTY trend arrays when the server omits trends — never fabricates", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...BASE_PAYLOAD,
        summary: { activeTutors: 8, sessionsThisWeek: 20 },
      }),
    );

    const result = await fetchParentSummary("parent-3");

    expect(result.activeTutorsTrend).toEqual([]);
    expect(result.sessionsThisWeekTrend).toEqual([]);
    // Scalar values still surface honestly.
    expect(result.activeTutors).toBe(8);
    expect(result.sessionsThisWeek).toBe(20);
  });

  it("preserves the honest empty-state payload when no learners or sessions exist", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        parent: { name: null, lastDashboardVisit: null },
        learners: [],
        summary: { activeTutors: 0, sessionsThisWeek: 0 },
      }),
    );

    const result = await fetchParentSummary("parent-empty");

    expect(result.learners).toEqual([]);
    expect(result.summary.activeTutors).toBe(0);
    expect(result.summary.sessionsThisWeek).toBe(0);
    expect(result.activeTutorsTrend).toEqual([]);
    expect(result.sessionsThisWeekTrend).toEqual([]);
  });

  it("gracefully handles a response with no learner data", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ parent: null, learners: [] }));

    const result = await fetchParentSummary("parent-5");

    expect(result.parent).toBeNull();
    expect(result.learners).toEqual([]);
    expect(result.activeTutors).toBe(0);
    expect(result.activeTutorsTrend).toEqual([]);
  });

  it("throws the upstream error instead of fabricating stats on failure", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));

    await expect(fetchParentSummary("parent-error")).rejects.toThrow("Forbidden");
  });
});

describe("useParentSummary", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("enters a loading state before the query resolves", async () => {
    const deferred = createDeferred<Response>();
    apiFetchMock.mockReturnValueOnce(deferred.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const observer = new QueryObserver(queryClient, parentSummaryQueryOptions("parent-loading"));

    const states: { status: string; fetchStatus: string }[] = [];
    const unsubscribe = observer.subscribe((result) => {
      states.push({ status: result.status, fetchStatus: result.fetchStatus });
    });

    const refetchPromise = observer.refetch();
    await Promise.resolve();

    expect(states).toContainEqual({ status: "pending", fetchStatus: "fetching" });

    deferred.resolve(
      jsonResponse({
        parent: { name: "Pat Parent", lastDashboardVisit: null },
        learners: [],
        summary: { activeTutors: 0, sessionsThisWeek: 0 },
      }),
    );
    await refetchPromise;

    unsubscribe();
    queryClient.clear();
  });
});
