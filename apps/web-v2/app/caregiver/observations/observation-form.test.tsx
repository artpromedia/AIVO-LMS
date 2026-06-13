// @vitest-environment jsdom

/**
 * Sprint C-10 — caregiver observation form polish.
 *
 * Pins the individually-verifiable DoD items for the caregiver flow:
 *   - the 3 worked ABC examples render (collapsible);
 *   - mood is selectable and rides the POST payload (round-trip start);
 *   - success is ANNOUNCED via an aria-live region, not a silent refresh;
 *   - a network failure leaves a recoverable localStorage draft, restored on
 *     the next mount; a successful submit clears it.
 */
import * as React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, vars?: Record<string, unknown>) =>
  vars && Object.keys(vars).length ? `${key}:${JSON.stringify(vars)}` : key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { CaregiverObservationForm } from "./observation-form";

const LEARNERS = [
  { id: "lrn-1", name: "Sky" },
  { id: "lrn-2", name: "River" },
];

const DRAFT_KEY = "aivo.caregiver.observation.draft";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("CaregiverObservationForm — examples + mood + aria-live", () => {
  it("renders the 3 worked ABC examples when expanded", () => {
    render(<CaregiverObservationForm learners={LEARNERS} />);
    fireEvent.click(screen.getByText("examples_toggle"));
    expect(screen.getByText("example_1")).toBeTruthy();
    expect(screen.getByText("example_2")).toBeTruthy();
    expect(screen.getByText("example_3")).toBeTruthy();
  });

  it("has a polite aria-live success region present from the start", () => {
    render(<CaregiverObservationForm learners={LEARNERS} />);
    const live = screen.getByTestId("observation-form-success");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.getAttribute("role")).toBe("status");
  });

  it("sends the selected mood in the POST body and announces success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => "" } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<CaregiverObservationForm learners={LEARNERS} />);
    fireEvent.change(screen.getByDisplayValue("choose_learner"), { target: { value: "lrn-1" } });
    fireEvent.change(screen.getByPlaceholderText("behaviour_placeholder"), {
      target: { value: "Sat calmly through reading" },
    });
    fireEvent.click(screen.getByTestId("mood-calm"));
    fireEvent.click(screen.getByTestId("observation-form-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.mood).toBe("calm");
    expect(body.learnerId).toBe("lrn-1");
    expect(body.behaviour).toBe("Sat calmly through reading");

    await waitFor(() =>
      expect(screen.getByTestId("observation-form-success").textContent).toBe("success_announce"),
    );
    // Success clears the recovery draft.
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("rejects a submit missing the 2 required fields without calling the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CaregiverObservationForm learners={LEARNERS} />);
    fireEvent.click(screen.getByTestId("observation-form-submit"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("observation-form-error").textContent).toBe("error_required");
  });
});

describe("CaregiverObservationForm — localStorage draft resilience", () => {
  it("persists a draft on a network failure and restores it on next mount", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", failing);

    const { unmount } = render(<CaregiverObservationForm learners={LEARNERS} />);
    fireEvent.change(screen.getByDisplayValue("choose_learner"), { target: { value: "lrn-2" } });
    fireEvent.change(screen.getByPlaceholderText("behaviour_placeholder"), {
      target: { value: "Drew a picture of the dog" },
    });
    fireEvent.click(screen.getByTestId("mood-happy"));
    fireEvent.click(screen.getByTestId("observation-form-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("observation-form-error").textContent).toBe("error_network"),
    );
    // The draft survived the failure.
    const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY)!);
    expect(saved.learnerId).toBe("lrn-2");
    expect(saved.behaviour).toBe("Drew a picture of the dog");
    expect(saved.mood).toBe("happy");

    unmount();

    // A fresh mount restores the in-progress note so nothing is lost.
    render(<CaregiverObservationForm learners={LEARNERS} />);
    expect((screen.getByPlaceholderText("behaviour_placeholder") as HTMLTextAreaElement).value).toBe(
      "Drew a picture of the dog",
    );
    const moodHappy = screen.getByTestId("mood-happy");
    expect(moodHappy.getAttribute("aria-checked")).toBe("true");
  });
});
