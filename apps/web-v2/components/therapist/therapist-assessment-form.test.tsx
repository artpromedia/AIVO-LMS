// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({ useTranslations: (_ns?: string) => stableT }));

import { TherapistAssessmentForm } from "./therapist-assessment-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TherapistAssessmentForm", () => {
  it("submits the parsed payload to the BFF and renders success", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as
      typeof fetch;
    vi.stubGlobal("fetch", fetchFn);
    render(<TherapistAssessmentForm learnerId="lrn-1" />);

    fireEvent.change(screen.getByLabelText("discipline"), { target: { value: "occupational" } });
    fireEvent.change(screen.getByLabelText("areas_of_focus"), {
      target: { value: "fine motor, pencil grip\nscissor skills" },
    });
    fireEvent.change(screen.getByLabelText("strengths"), {
      target: { value: "persistent" },
    });
    fireEvent.change(screen.getByLabelText("sensory_notes"), {
      target: { value: "Avoids loud rooms." },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByText("success_title")).toBeTruthy();

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]! as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/bff/learners/lrn-1/therapist-assessment");
    const body = JSON.parse(String(init.body));
    expect(body.therapyDiscipline).toBe("occupational");
    expect(body.areasOfFocus).toEqual(["fine motor", "pencil grip", "scissor skills"]);
    expect(body.strengths).toEqual(["persistent"]);
    expect(body.sensoryNotes).toBe("Avoids loud rooms.");
    // Empty optional notes are omitted, not sent as empty strings.
    expect("observations" in body).toBe(false);
  });

  it("renders the error state on a failed submit and allows retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch,
    );
    render(<TherapistAssessmentForm learnerId="lrn-1" />);
    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // Form is still editable for retry.
    expect(screen.getByRole("button", { name: "submit" })).toBeTruthy();
  });
});
