/**
 * Regression: a network failure reaching recommendation-svc must surface as the
 * "recommendation-svc list failed" error the BFF route maps to
 * UPSTREAM_UNAVAILABLE (502, retryable) — not escape as a raw 500. Previously
 * `fetch` rejecting (svc down / unreachable) fell through to the route's
 * failFromUnknown → INTERNAL_ERROR 500, which is what showed in the console.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listRecommendationsForLearner, respondToRecommendation } from "./recommendation-svc";

const SESSION = { userId: "u1", tenantId: "t1" };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listRecommendationsForLearner", () => {
  it("maps a network failure (fetch rejects) to a 'list failed' error", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:3066"));
    await expect(listRecommendationsForLearner(SESSION, "lrn1")).rejects.toThrow(
      /recommendation-svc list failed/,
    );
  });

  it("maps a non-2xx response to a 'list failed' error carrying the status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await expect(listRecommendationsForLearner(SESSION, "lrn1")).rejects.toThrow(
      /recommendation-svc list failed: 503/,
    );
  });

  it("splits pending vs decided on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        recommendations: [
          { id: "r1", status: "PENDING" },
          { id: "r2", status: "APPLIED" },
        ],
      }),
    });
    const out = await listRecommendationsForLearner(SESSION, "lrn1");
    expect(out.pending.map((r) => r.id)).toEqual(["r1"]);
    expect(out.decided.map((r) => r.id)).toEqual(["r2"]);
  });
});

describe("respondToRecommendation", () => {
  it("returns a retryable ok:false 502 on network failure (no unhandled throw)", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    const out = await respondToRecommendation(SESSION, "r1", "accept", {});
    expect(out).toMatchObject({ ok: false, status: 502 });
  });
});
