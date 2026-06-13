// @vitest-environment jsdom

/**
 * Parent assessment field-level autosave (Sprint C-11).
 *
 * Substitutes the screenshot DoD with executable proof of the saved-indicator
 * contract:
 *   - type → idle → a draft PATCH lands per section on the active step with the
 *     parsed payload, and the indicator settles on "Saved" (data-state=saved);
 *   - a failed save surfaces the retry state ("Couldn't save — retrying…") and
 *     never throws / never blocks;
 *   - the per-section payload builder mirrors the server action's list parsing
 *     and coercion (so an autosaved draft equals a Save & continue write).
 *
 * Mirrors the C-10 therapist autosave test conventions (jsdom, mocked next-intl,
 * fake timers for the debounce window).
 */
import React from "react";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, vars?: Record<string, unknown>) =>
  vars && Object.keys(vars).length ? `${key}:${JSON.stringify(vars)}` : key;
vi.mock("next-intl", () => ({ useTranslations: (_ns?: string) => stableT }));

import { AssessmentAutosave, buildSectionPayload } from "./assessment-autosave";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

/** A minimal wizard-shaped form so the island can read live FormData. */
function ConcernsForm() {
  return (
    <AssessmentAutosave learnerId="lrn-1" sections={["concerns"]} debounceMs={1600}>
      <form>
        <textarea name="concerns.concerns" aria-label="concerns" defaultValue="" />
      </form>
    </AssessmentAutosave>
  );
}

describe("AssessmentAutosave — type → idle → persisted draft + Saved", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("debounces, PATCHes the touched section, and shows the Saved indicator", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { savedAt: "now" } }),
    } as Response);
    vi.stubGlobal("fetch", fetchFn);

    render(<ConcernsForm />);

    // Type into the field.
    fireEvent.input(screen.getByLabelText("concerns"), {
      target: { value: "Worried about reading confidence" },
    });

    // Before the debounce elapses, nothing has been saved.
    expect(fetchFn).not.toHaveBeenCalled();

    // Advance past the debounce window; flush the async save.
    await act(async () => {
      vi.advanceTimersByTime(1700);
    });
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/bff/learners/lrn-1/parent-assessment");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(String(init.body));
    expect(body.section).toBe("concerns");
    expect(body.data).toEqual({ concerns: "Worried about reading confidence" });

    // Indicator settles on "saved".
    await vi.waitFor(() =>
      expect(screen.getByTestId("parent-autosave").getAttribute("data-state")).toBe("saved"),
    );
  });

  it("surfaces the retry state on a failed save without throwing", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchFn);

    render(<ConcernsForm />);
    fireEvent.input(screen.getByLabelText("concerns"), { target: { value: "x" } });
    await act(async () => {
      vi.advanceTimersByTime(1700);
    });
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(screen.getByTestId("parent-autosave").getAttribute("data-state")).toBe("retry"),
    );
  });
});

describe("buildSectionPayload — server-action parity", () => {
  function fd(entries: Array<[string, string]>): FormData {
    const f = new FormData();
    for (const [k, v] of entries) f.append(k, v);
    return f;
  }

  it("parses newline/comma lists like the server action (goals capped at 8)", () => {
    const form = fd([["goals.goals", "read more\nwrite a story, finish homework"]]);
    expect(buildSectionPayload(form, "goals")).toEqual({
      goals: ["read more", "write a story", "finish homework"],
    });
  });

  it("coerces number fields and emits booleans for checkboxes", () => {
    const form = fd([
      ["homework.bestTimeOfDay", "morning"],
      ["homework.typicalSessionMinutes", "25"],
      ["homework.needsCoaching", "on"],
    ]);
    expect(buildSectionPayload(form, "homework")).toEqual({
      bestTimeOfDay: "morning",
      typicalSessionMinutes: 25,
      needsCoaching: true,
    });
  });

  it("folds the 'other' diagnoses free-text into the diagnoses array", () => {
    const form = fd([
      ["background.diagnoses", "adhd"],
      ["background.diagnoses", "dyslexia"],
      ["background.diagnosesOther", "APD, mild hearing loss"],
    ]);
    expect(buildSectionPayload(form, "background")).toEqual({
      diagnoses: ["adhd", "dyslexia", "APD", "mild hearing loss"],
    });
  });

  it("emits an empty object for an untouched section (a no-op draft)", () => {
    expect(buildSectionPayload(new FormData(), "concerns")).toEqual({});
    // A lone unchecked checkbox still persists `false` (a real answer).
    expect(buildSectionPayload(new FormData(), "homework")).toEqual({ needsCoaching: false });
  });

  it("collects multi-select values (focus subjects)", () => {
    const form = fd([
      ["grade_subject.gradeBand", "3-5"],
      ["grade_subject.focusSubjects", "math"],
      ["grade_subject.focusSubjects", "reading"],
    ]);
    expect(buildSectionPayload(form, "grade_subject")).toEqual({
      gradeBand: "3-5",
      focusSubjects: ["math", "reading"],
    });
  });
});
