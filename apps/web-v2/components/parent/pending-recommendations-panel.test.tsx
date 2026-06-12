// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stable identity across renders — the component lists `t` in effect deps
// (matching the real next-intl, which returns a stable function), so the
// mock must too or every render re-triggers the load effect.
const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));


import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

import {
  PendingRecommendationsPanel,
  type PanelRecommendation,
} from "./pending-recommendations-panel";

const REC: PanelRecommendation = {
  id: "rec-1",
  type: "delivery_level_change",
  title: "Raise delivery level — sustained mastery",
  parentSummary: "Your learner has mastered 3 skills at grade level.",
  currentValue: "3",
  proposedValue: { subjectId: "sub-math", from: "3", to: "4" },
  evidence: [
    { source: "lesson", summary: "Mastery moved on skl-1" },
    { source: "lesson", summary: "Mastery moved on skl-2" },
  ],
  status: "PENDING",
  createdAt: "2026-06-01T00:00:00.000Z",
};

function stubFetch(handlers: Record<string, (init?: RequestInit) => unknown>) {
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    const key = Object.keys(handlers).find((k) => String(url).includes(k));
    if (!key) throw new Error(`unexpected fetch ${String(url)}`);
    return { ok: true, status: 200, json: async () => handlers[key]!(init) };
  }) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PendingRecommendationsPanel", () => {
  it("renders pending recommendations with the proposed change", async () => {
    stubFetch({
      "/recommendations": () => ({ ok: true, requestId: "t", data: { pending: [REC], decided: [] } }),
    });
    renderWithQuery(<PendingRecommendationsPanel learnerId="lrn-1" />);
    await waitFor(() =>
      expect(screen.getByText("Raise delivery level — sustained mastery")).toBeTruthy(),
    );
    expect(screen.getByText("3 → 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "approve" })).toBeTruthy();
  });

  it("renders the empty state", async () => {
    stubFetch({ "/recommendations": () => ({ ok: true, requestId: "t", data: { pending: [], decided: [] } }) });
    renderWithQuery(<PendingRecommendationsPanel learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByText("empty")).toBeTruthy());
  });

  it("approve posts to the respond route and renders applied inline", async () => {
    const fn = stubFetch({
      "/respond": () => ({ ok: true, requestId: "t", data: { recommendation: { ...REC, status: "APPLIED" } } }),
      "/recommendations": () => ({ ok: true, requestId: "t", data: { pending: [REC], decided: [] } }),
    });
    renderWithQuery(<PendingRecommendationsPanel learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "approve" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "approve" }));
    await waitFor(() => expect(screen.getByTestId("decided-card")).toBeTruthy());
    expect(screen.getByText("status_applied")).toBeTruthy();
    const respondCall = (fn as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes("/respond"),
    )!;
    expect(String(respondCall[0])).toBe(
      "/api/bff/learners/lrn-1/recommendations/rec-1/respond",
    );
    expect(JSON.parse(String((respondCall[1] as RequestInit).body))).toEqual({
      action: "accept",
    });
  });

  it("decline requires a reason before posting", async () => {
    stubFetch({
      "/respond": () => ({ ok: true, requestId: "t", data: { recommendation: { ...REC, status: "DECLINED" } } }),
      "/recommendations": () => ({ ok: true, requestId: "t", data: { pending: [REC], decided: [] } }),
    });
    renderWithQuery(<PendingRecommendationsPanel learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "decline" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "decline" }));
    const confirm = screen.getByRole("button", { name: "confirm_decline" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("decline_reason_label"), {
      target: { value: "Not yet" },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByText("status_declined")).toBeTruthy());
  });

  it("renders the error state when the list fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }) as unknown as typeof fetch,
    );
    renderWithQuery(<PendingRecommendationsPanel learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});
