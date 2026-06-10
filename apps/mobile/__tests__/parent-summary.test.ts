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

describe("useParentSummary", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("GETs /api/family/summary/:parentId and returns the parent summary payload", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        parent: { name: "Pat Parent", lastDashboardVisit: "2026-06-10T00:00:00.000Z" },
        learners: [{ id: "learner-1", badgeCount: 2 }],
        summary: { activeTutors: 3, sessionsThisWeek: 5 },
      }),
    );

    const result = await fetchParentSummary("parent-1");

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/summary/parent-1");
    expect(init).toBeUndefined();
    expect(result.summary).toEqual({ activeTutors: 3, sessionsThisWeek: 5 });
    expect(result.learners).toHaveLength(1);
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
  });

  it("throws the upstream error instead of fabricating stats on failure", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));

    await expect(fetchParentSummary("parent-error")).rejects.toThrow("Forbidden");
  });
});
