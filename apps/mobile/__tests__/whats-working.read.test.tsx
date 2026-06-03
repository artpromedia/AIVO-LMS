/**
 * Pinned contract: the parent "What's Working" card MUST call the real
 * family-svc analytics endpoint
 * (`GET /api/family/whats-working/:learnerId?windowDays=N`) and surface the
 * three IEP-ready signals when data is present. With zero sessions it must
 * render the calm empty state — no placeholder card pretending insights exist.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/constants/api", () => ({
  API: { FAMILY: "https://family.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { fetchWhatsWorking } from "../hooks/useWhatsWorking";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchWhatsWorking (parent dashboard analytics)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("GETs /api/family/whats-working/:learnerId with the requested window and returns the three signals", async () => {
    const payload = {
      windowDays: 30,
      totalSessions: 12,
      bestWindow: { timeOfDay: "morning", meanAccuracy: 0.82 },
      modalityFit: [
        { subject: "Reading", modality: "visual", meanAccuracy: 0.91 },
        { subject: "Math", modality: "kinesthetic", meanAccuracy: 0.74 },
      ],
      frustrationHotspots: [{ subject: "Math", modality: "reading", meanFrustration: 0.45 }],
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const result = await fetchWhatsWorking("learner-1", 30);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://family.test");
    expect(path).toBe("/api/family/whats-working/learner-1?windowDays=30");
    // Pure read — no method override should sneak in.
    expect(init).toBeUndefined();

    expect(result.totalSessions).toBe(12);
    expect(result.bestWindow?.timeOfDay).toBe("morning");
    expect(result.modalityFit).toHaveLength(2);
    expect(result.frustrationHotspots[0].subject).toBe("Math");
  });

  it("returns the empty-state shape (no fabricated card) when family-svc reports zero sessions", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        windowDays: 30,
        totalSessions: 0,
        bestWindow: null,
        modalityFit: [],
        frustrationHotspots: [],
      }),
    );

    const result = await fetchWhatsWorking("learner-2", 30);

    expect(result.totalSessions).toBe(0);
    expect(result.bestWindow).toBeNull();
    expect(result.modalityFit).toEqual([]);
    expect(result.frustrationHotspots).toEqual([]);
  });

  it("forwards the windowDays selector (e.g. 90) verbatim to the upstream URL", async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        windowDays: 90,
        totalSessions: 5,
        bestWindow: null,
        modalityFit: [],
        frustrationHotspots: [],
      }),
    );

    await fetchWhatsWorking("learner-3", 90);

    const [, path] = apiFetchMock.mock.calls[0];
    expect(path).toBe("/api/family/whats-working/learner-3?windowDays=90");
  });

  it("throws the upstream error message on a non-2xx response (so React Query surfaces an error state instead of fake data)", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, 403));

    await expect(fetchWhatsWorking("learner-4", 30)).rejects.toThrow("Forbidden");
  });
});
