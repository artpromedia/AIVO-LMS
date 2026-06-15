// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TUTORS } from "@aivo/brand";
import { AnswerFeedback } from "./answer-feedback";

afterEach(cleanup);

describe("AnswerFeedback — robot-family reaction", () => {
  it("shows the tutor's full robot portrait on a miss when motion is on", () => {
    const { container } = render(
      <AnswerFeedback tone="incorrect" motionOff={false} tutorSlug="nova">
        Not quite — try again.
      </AnswerFeedback>,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(TUTORS.nova.avatar);
    // Decorative: no accessible name, hidden from the a11y tree.
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses the reduced (static) portrait when motion is off", () => {
    const { container } = render(
      <AnswerFeedback tone="incorrect" motionOff tutorSlug="sage">
        Not quite — try again.
      </AnswerFeedback>,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(TUTORS.sage.avatarReduced);
  });

  it("renders no portrait on a correct answer", () => {
    const { container } = render(
      <AnswerFeedback tone="correct" motionOff={false} tutorSlug="nova">
        You got it!
      </AnswerFeedback>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-feedback="correct"]')).not.toBeNull();
  });

  it("falls back to a neutral cheer when no tutor is resolved", () => {
    const { container } = render(
      <AnswerFeedback tone="incorrect" motionOff={false} tutorSlug={null}>
        Keep going!
      </AnswerFeedback>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("💪")).toBeTruthy();
  });
});
