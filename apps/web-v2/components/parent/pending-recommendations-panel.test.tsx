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
    expect(screen.getByRole("button", { name: "accept" })).toBeTruthy();
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
    await waitFor(() => expect(screen.getByRole("button", { name: "accept" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
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
    await waitFor(() => expect(screen.getByRole("button", { name: "deny" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "deny" }));
    const confirm = screen.getByRole("button", { name: "confirm_decline" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("decline_reason_label"), {
      target: { value: "Not yet" },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByText("status_declined")).toBeTruthy());
  });

  it("add-context sends the note, shows context-sent, and undo reverts to pending", async () => {
    const fn = stubFetch({
      "/respond": (init) => {
        const action = JSON.parse(String((init as RequestInit).body)).action;
        const status = action === "undo" ? "PENDING" : "CONTEXT_ADDED";
        return { ok: true, requestId: "t", data: { recommendation: { ...REC, status } } };
      },
      "/recommendations": () => ({ ok: true, requestId: "t", data: { pending: [REC], decided: [] } }),
    });
    renderWithQuery(<PendingRecommendationsPanel learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "add_context" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "add_context" }));

    const send = screen.getByRole("button", { name: "send_to_aivo" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("add_context_label"), {
      target: { value: "Speech therapy Tuesday mornings" },
    });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);

    await waitFor(() => expect(screen.getByText("status_context")).toBeTruthy());
    const ctxCall = (fn as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => (c[1] as RequestInit)?.body && JSON.parse(String((c[1] as RequestInit).body)).action === "add_context",
    )!;
    expect(JSON.parse(String((ctxCall[1] as RequestInit).body))).toEqual({
      action: "add_context",
      context: "Speech therapy Tuesday mornings",
    });

    // Undo returns the card to its actionable state.
    fireEvent.click(screen.getByRole("button", { name: "undo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "accept" })).toBeTruthy());
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
