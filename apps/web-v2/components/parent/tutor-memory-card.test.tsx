// @vitest-environment jsdom

import * as React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));

import { TutorMemoryCard } from "./tutor-memory-card";

const MEMORIES = [
  {
    id: "mem-1",
    tutorKey: "nova",
    kind: "strategy_preference",
    content: "Worked examples before practice help.",
    createdAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2026-11-28T00:00:00.000Z",
  },
  {
    id: "mem-2",
    tutorKey: "sage",
    kind: "interest",
    content: "Loves trains.",
    createdAt: "2026-06-02T00:00:00.000Z",
    expiresAt: "2026-11-29T00:00:00.000Z",
  },
];

function stubFetch(handlers: Record<string, (init?: RequestInit) => { status: number; body: unknown }>) {
  const fn = vi.fn(async (url: unknown, init?: RequestInit) => {
    const key = Object.keys(handlers).find((k) => String(url).includes(k));
    if (!key) throw new Error(`unexpected fetch ${String(url)}`);
    const { status, body } = handlers[key]!(init);
    return { ok: status < 300, status, json: async () => body };
  }) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TutorMemoryCard", () => {
  it("renders nothing for off-pilot tenants (enabled:false)", async () => {
    stubFetch({
      "/tutor-memories": () => ({
        status: 200,
        body: { ok: true, data: { enabled: false, memories: [] } },
      }),
    });
    render(<TutorMemoryCard learnerId="lrn-1" />);
    await waitFor(() => expect(screen.queryByTestId("tutor-memory-card")).toBeNull());
  });

  it("lists every memory with kind, tutor, and expiry — nothing hidden", async () => {
    stubFetch({
      "/tutor-memories": () => ({
        status: 200,
        body: { ok: true, data: { enabled: true, memories: MEMORIES } },
      }),
    });
    render(<TutorMemoryCard learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getAllByTestId("tutor-memory-row")).toHaveLength(2));
    expect(screen.getByText("Worked examples before practice help.")).toBeTruthy();
    expect(screen.getByText("Loves trains.")).toBeTruthy();
    expect(screen.getByText("kind_strategy_preference")).toBeTruthy();
    expect(screen.getByText(/Nova/)).toBeTruthy();
  });

  it("delete removes the row after the server confirms", async () => {
    const fetchFn = stubFetch({
      "/tutor-memories/mem-1": (init) => {
        expect(init?.method).toBe("DELETE");
        return { status: 200, body: { ok: true, data: { deleted: true } } };
      },
      "/tutor-memories": () => ({
        status: 200,
        body: { ok: true, data: { enabled: true, memories: [MEMORIES[0]] } },
      }),
    });
    render(<TutorMemoryCard learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getAllByTestId("tutor-memory-row")).toHaveLength(1));
    fireEvent.click(screen.getByText("delete"));
    await waitFor(() => expect(screen.queryAllByTestId("tutor-memory-row")).toHaveLength(0));
    expect(screen.getByTestId("tutor-memory-empty")).toBeTruthy();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("shows the calm empty state when enabled with no rows", async () => {
    stubFetch({
      "/tutor-memories": () => ({
        status: 200,
        body: { ok: true, data: { enabled: true, memories: [] } },
      }),
    });
    render(<TutorMemoryCard learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByTestId("tutor-memory-empty")).toBeTruthy());
  });
});
