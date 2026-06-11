// @vitest-environment jsdom

/**
 * Wave B — the school-calendar editor performs a REAL network write: it
 * loads the stored calendar on mount, blocks save on local date problems,
 * and PUTs the schema-shaped payload on save (a fake-save here would have
 * silently lost the parent's dates — the exact bug class Wave B closes).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));

import { SchoolCalendarManager } from "./school-calendar-manager";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubFetch(onPut: (body: unknown) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ data: { calendar: null } }), { status: 200 });
      }
      onPut(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ data: { calendar: { id: "cal1" } } }), {
        status: 200,
      });
    }) as unknown as typeof fetch,
  );
}

describe("SchoolCalendarManager", () => {
  it("PUTs the entered terms and breaks to the BFF on save", async () => {
    let putBody: unknown = null;
    stubFetch((body) => {
      putBody = body;
    });
    render(<SchoolCalendarManager apiBase="/api/bff/parent/learners/l1/school-calendar" learnerName="Sky" />);

    // Wait for the initial load to enable the save button.
    await waitFor(() =>
      expect((screen.getByText("save") as HTMLButtonElement).disabled).toBe(false),
    );

    const starts = screen.getAllByLabelText("start_date") as HTMLInputElement[];
    const ends = screen.getAllByLabelText("end_date") as HTMLInputElement[];
    fireEvent.change(starts[0]!, { target: { value: "2026-09-01" } });
    fireEvent.change(ends[0]!, { target: { value: "2026-12-18" } });

    fireEvent.click(screen.getByText("add_break"));
    const starts2 = screen.getAllByLabelText("start_date") as HTMLInputElement[];
    const ends2 = screen.getAllByLabelText("end_date") as HTMLInputElement[];
    fireEvent.change(starts2[1]!, { target: { value: "2026-11-25" } });
    fireEvent.change(ends2[1]!, { target: { value: "2026-11-27" } });

    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toMatchObject({
      timezone: "America/Chicago",
      terms: [{ termNumber: 1, startDate: "2026-09-01", endDate: "2026-12-18" }],
      breaks: [{ kind: "holiday", startDate: "2026-11-25", endDate: "2026-11-27" }],
    });
  });

  it("blocks save with an inline error when an end date precedes its start", async () => {
    const put = vi.fn();
    stubFetch(put);
    render(<SchoolCalendarManager apiBase="/api/x" learnerName="Sky" />);
    await waitFor(() =>
      expect((screen.getByText("save") as HTMLButtonElement).disabled).toBe(false),
    );

    const starts = screen.getAllByLabelText("start_date") as HTMLInputElement[];
    const ends = screen.getAllByLabelText("end_date") as HTMLInputElement[];
    fireEvent.change(starts[0]!, { target: { value: "2026-12-18" } });
    fireEvent.change(ends[0]!, { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByText("save"));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("error_end_before_start"));
    expect(put).not.toHaveBeenCalled();
  });
});
