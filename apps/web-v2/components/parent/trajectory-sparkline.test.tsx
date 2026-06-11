// @vitest-environment jsdom

import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MasterySnapshot } from "@/lib/db/types";
import { TrajectorySparkline } from "./trajectory-sparkline";
import { RefreshLearningPathButton } from "./refresh-learning-path-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function snap(capturedAt: string, averageScore: number): MasterySnapshot {
  return {
    id: `ms-${capturedAt}`,
    learnerId: "lrn-1",
    tenantId: "t-1",
    subjectId: "sub-1",
    capturedAt,
    averageScore,
    level: "emerging",
    skillsOnGradeLevel: 1,
    skillsTotal: 4,
    deliveryLevel: "2",
    gradeBand: "5",
    trigger: "baseline",
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TrajectorySparkline", () => {
  it("renders an accessible rising trajectory", () => {
    render(
      <TrajectorySparkline
        snapshots={[snap("2026-01-01", 0.3), snap("2026-02-01", 0.45), snap("2026-03-01", 0.6)]}
        label="Math"
      />,
    );
    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toContain("rising");
    expect(svg.getAttribute("aria-label")).toContain("30%");
    expect(svg.getAttribute("aria-label")).toContain("60%");
  });

  it("renders nothing without snapshots", () => {
    const { container } = render(<TrajectorySparkline snapshots={[]} label="Math" />);
    expect(container.innerHTML).toBe("");
  });

  it("draws a flat segment for a single capture", () => {
    render(<TrajectorySparkline snapshots={[snap("2026-01-01", 0.5)]} label="Reading" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("steady");
  });
});

describe("RefreshLearningPathButton", () => {
  const labels = { idle: "refresh", done: "done", error: "error" };

  it("posts to the learning-path BFF route and shows success", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as
      typeof fetch;
    vi.stubGlobal("fetch", fetchFn);
    render(<RefreshLearningPathButton learnerId="lrn-1" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "done" })).toBeTruthy());
    expect(fetchFn).toHaveBeenCalledWith("/api/bff/learners/lrn-1/learning-path/generate", {
      method: "POST",
    });
  });

  it("shows the error label on a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch,
    );
    render(<RefreshLearningPathButton learnerId="lrn-1" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "error" })).toBeTruthy());
  });
});
