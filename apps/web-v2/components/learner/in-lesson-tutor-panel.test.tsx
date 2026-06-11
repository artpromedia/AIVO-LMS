// @vitest-environment jsdom

import * as React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));

import { InLessonTutorPanel } from "./in-lesson-tutor-panel";

const TUTOR = { tutorKey: "nova", name: "Nova", icon: "🔢", color: "#7C3AED" };

function renderPanel(overrides: Partial<React.ComponentProps<typeof InLessonTutorPanel>> = {}) {
  const props: React.ComponentProps<typeof InLessonTutorPanel> = {
    tutor: TUTOR,
    message: null,
    thinking: false,
    breakOffer: null,
    onAcceptBreak: vi.fn(),
    onDeclineBreak: vi.fn(),
    endEarly: null,
    onFinishEarly: vi.fn(),
    reducedMotion: true,
    ...overrides,
  };
  render(<InLessonTutorPanel {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InLessonTutorPanel", () => {
  it("renders the tutor identity and idle line by default", () => {
    renderPanel();
    expect(screen.getByTestId("in-lesson-tutor-panel")).toBeTruthy();
    expect(screen.getByText("tutor_panel_watching")).toBeTruthy();
    expect(screen.getByText("tutor_panel_idle")).toBeTruthy();
  });

  it("shows the agent message in a polite live region", () => {
    renderPanel({ message: "You are very close — check the tens place." });
    const msg = screen.getByTestId("tutor-panel-message");
    expect(msg.textContent).toBe("You are very close — check the tens place.");
    expect(msg.closest("[aria-live='polite']")).toBeTruthy();
  });

  it("shows thinking state without the pulse animation under reduced motion", () => {
    renderPanel({ thinking: true, reducedMotion: true });
    const thinking = screen.getByTestId("tutor-panel-thinking");
    expect(thinking.className).not.toContain("animate-pulse");
  });

  it("break offer is the learner's choice: accept and decline both work", () => {
    const props = renderPanel({ breakOffer: { durationSeconds: 60 } });
    expect(screen.getByTestId("tutor-panel-break-offer")).toBeTruthy();
    fireEvent.click(screen.getByText("tutor_panel_break_yes"));
    expect(props.onAcceptBreak).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("tutor_panel_break_no"));
    expect(props.onDeclineBreak).toHaveBeenCalledTimes(1);
  });

  it("end-early renders the wind-down CTA", () => {
    const props = renderPanel({ endEarly: { reason: "fatigue" } });
    expect(screen.getByTestId("tutor-panel-end-early")).toBeTruthy();
    fireEvent.click(screen.getByText("tutor_panel_finish_now"));
    expect(props.onFinishEarly).toHaveBeenCalledTimes(1);
  });
});
