// @vitest-environment jsdom

/**
 * Therapist assessment form (Sprint 6 submit contract + Sprint C-10 polish).
 *
 * The form now LOADS a draft + IEP panel on mount (GET) before it is editable,
 * autosaves edits (debounced PATCH), and renders a timestamped SUBMISSION
 * RECORD on success. These tests pin:
 *   - the submit payload shape (the GET on mount is accounted for);
 *   - the error/retry state;
 *   - draft restore-after-kill with a "Saved" indicator;
 *   - the IEP side-panel goals (authorized read) + empty state;
 *   - the post-submit summary record.
 */
import React from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, vars?: Record<string, unknown>) =>
  vars && Object.keys(vars).length ? `${key}:${JSON.stringify(vars)}` : key;
vi.mock("next-intl", () => ({ useTranslations: (_ns?: string) => stableT }));

import { TherapistAssessmentForm } from "./therapist-assessment-form";

/** A mount-GET response with an empty draft + no IEP, unless overridden. */
function mountGet(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      data: { draft: { answers: {} }, status: { completed: false }, iep: { onFile: false }, ...over },
    }),
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TherapistAssessmentForm — submit contract", () => {
  it("submits the parsed payload to the BFF and renders the submission record", async () => {
    const record = {
      assessmentId: "ta-1",
      submittedAt: "2026-06-13T12:00:00.000Z",
      elapsedSeconds: 120,
      therapyDiscipline: "occupational",
      areasOfFocus: ["fine motor", "pencil grip", "scissor skills"],
      strengths: ["persistent"],
      challenges: [],
      regulationStrategies: [],
      recommendedAccommodations: [],
      sensoryNotes: "Avoids loud rooms.",
      communicationNotes: null,
      observations: null,
    };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mountGet())
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { record } }) } as Response);
    vi.stubGlobal("fetch", fetchFn);

    render(<TherapistAssessmentForm learnerId="lrn-1" />);
    // Wait for the mount GET to resolve (form becomes editable).
    await waitFor(() => expect(screen.getByTestId("iep-panel-empty")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("discipline"), { target: { value: "occupational" } });
    fireEvent.change(screen.getByLabelText("areas_of_focus"), {
      target: { value: "fine motor, pencil grip\nscissor skills" },
    });
    fireEvent.change(screen.getByLabelText("strengths"), { target: { value: "persistent" } });
    fireEvent.change(screen.getByLabelText("sensory_notes"), {
      target: { value: "Avoids loud rooms." },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => expect(screen.getByTestId("therapist-submission-record")).toBeTruthy());

    // Find the POST call (method POST), not the GET / PATCH autosaves.
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls as Array<[string, RequestInit]>;
    const post = calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/bff/learners/lrn-1/therapist-assessment");
    const body = JSON.parse(String(post[1].body));
    expect(body.therapyDiscipline).toBe("occupational");
    expect(body.areasOfFocus).toEqual(["fine motor", "pencil grip", "scissor skills"]);
    expect(body.strengths).toEqual(["persistent"]);
    expect(body.sensoryNotes).toBe("Avoids loud rooms.");
    expect("observations" in body).toBe(false);
    // The client owns the wall-clock that anchors elapsed telemetry.
    expect(typeof body.startedAtMs).toBe("number");

    // The submission record shows what was shared.
    expect(screen.getByText("persistent")).toBeTruthy();
    expect(screen.getByText("Avoids loud rooms.")).toBeTruthy();
  });

  it("renders the error state on a failed submit and allows retry", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mountGet())
      .mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchFn);

    render(<TherapistAssessmentForm learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByTestId("iep-panel-empty")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "submit" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: "submit" })).toBeTruthy();
  });
});

describe("TherapistAssessmentForm — draft restore + IEP panel", () => {
  it("restores an in-progress draft on mount and shows the Saved indicator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mountGet({
          draft: {
            answers: {
              form: { therapyDiscipline: "occupational", strengths: ["tracks to midline"] },
            },
            startedAtMs: 1_700_000_000_000,
          },
        }),
      ),
    );
    render(<TherapistAssessmentForm learnerId="lrn-1" />);

    expect(screen.getByText("time_estimate")).toBeTruthy();
    await waitFor(() =>
      expect((screen.getByDisplayValue(/tracks to midline/) as HTMLTextAreaElement).value).toContain(
        "tracks to midline",
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("therapist-save-indicator").getAttribute("data-state")).toBe("saved"),
    );
  });

  it("renders the learner's IEP goals + accommodations (authorized read)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mountGet({
          iep: {
            onFile: true,
            goals: ["Will read 80 wpm with 95% accuracy"],
            accommodations: ["Extended time"],
            serviceAreas: ["Speech"],
            summary: "Strong oral language; emerging decoding.",
            uploadedAt: "2026-05-01T00:00:00.000Z",
          },
        }),
      ),
    );
    render(<TherapistAssessmentForm learnerId="lrn-1" />);
    await waitFor(() => expect(screen.getByTestId("iep-panel-content")).toBeTruthy());
    expect(screen.getByText("Will read 80 wpm with 95% accuracy")).toBeTruthy();
    expect(screen.getByText("Extended time")).toBeTruthy();
    expect(screen.getByText("Strong oral language; emerging decoding.")).toBeTruthy();
  });
});
