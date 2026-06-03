// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// next-intl is configured by the App Router runtime. In a unit test we
// don't have that context, so stub `useTranslations` with a small
// identity fn that echoes the key (good enough to assert structure
// without coupling to copy).
vi.mock("next-intl", () => ({
  useTranslations:
    (_ns?: string) =>
    (key: string, _vars?: Record<string, unknown>) =>
      key,
}));

import { WhatsWorkingPanel } from "./whats-working-panel";

function mockFetch(payload: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("<WhatsWorkingPanel>", () => {
  it("hits /api/bff/parent/learners/:id/whats-working with the active window and renders all three signals when seeded", async () => {
    const fetchSpy = mockFetch({
      data: {
        windowDays: 30,
        totalSessions: 12,
        bestWindow: { timeOfDay: "morning", meanAccuracy: 0.82 },
        modalityFit: [
          { subject: "Reading", modality: "visual", meanAccuracy: 0.91 },
          { subject: "Math", modality: "kinesthetic", meanAccuracy: 0.74 },
        ],
        frustrationHotspots: [
          { subject: "Math", modality: "reading", meanFrustration: 0.45 },
        ],
      },
    });

    render(<WhatsWorkingPanel learnerId="lr_1" learnerName="Sam" />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const url = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe("/api/bff/parent/learners/lr_1/whats-working?windowDays=30");

    // Three labels should appear (translation keys echoed back).
    await waitFor(() => {
      expect(screen.getByText("best_window")).toBeTruthy();
      expect(screen.getByText("modality_fit")).toBeTruthy();
      expect(screen.getByText("frustration")).toBeTruthy();
    });
    // Values: best window time-of-day, top modality, top hotspot subject.
    expect(screen.getByText("tod_morning")).toBeTruthy();
    expect(screen.getByText("modality_visual")).toBeTruthy();
    expect(screen.getByText("Math")).toBeTruthy();
  });

  it("renders the calm empty state (no placeholder card) when there are fewer than two observations", async () => {
    mockFetch({
      data: {
        windowDays: 30,
        totalSessions: 0,
        bestWindow: null,
        modalityFit: [],
        frustrationHotspots: [],
      },
    });

    render(<WhatsWorkingPanel learnerId="lr_2" learnerName="Riley" />);

    await waitFor(() => {
      expect(screen.getByText("empty")).toBeTruthy();
    });
    // The three-signal grid must NOT mount when there's no data.
    expect(screen.queryByText("best_window")).toBeNull();
    expect(screen.queryByText("modality_fit")).toBeNull();
    expect(screen.queryByText("frustration")).toBeNull();
  });

  it("surfaces a load error instead of inventing data when the BFF response has no payload", async () => {
    mockFetch({ error: "UPSTREAM_UNAVAILABLE" }, false, 502);

    render(<WhatsWorkingPanel learnerId="lr_3" learnerName="Jules" />);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("load_error");
    });
  });
});
