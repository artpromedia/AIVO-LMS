// @vitest-environment jsdom

/**
 * Wave A (G2) — the provenance badge renders the label + the
 * machine-readable provenance attribute the e2e/a11y layers key on.
 */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BaselineProvenanceBadge } from "./baseline-provenance-badge";

afterEach(cleanup);

describe("BaselineProvenanceBadge", () => {
  it("renders the cohort-bank state without claiming child-specific personalization", () => {
    render(
      <BaselineProvenanceBadge
        personalization="cohort_bank"
        tone="primary"
        label="AI question bank — matched to grade & profile"
      />,
    );
    const badge = screen.getByTestId("baseline-provenance-badge");
    expect(badge.getAttribute("data-provenance")).toBe("cohort_bank");
    expect(badge.textContent).toContain("AI question bank");
  });

  it("renders the child-specific and generic states", () => {
    const { rerender } = render(
      <BaselineProvenanceBadge
        personalization="child_specific"
        tone="primary"
        label="Personalized by AI for your child"
      />,
    );
    expect(
      screen.getByTestId("baseline-provenance-badge").getAttribute("data-provenance"),
    ).toBe("child_specific");
    rerender(
      <BaselineProvenanceBadge personalization="generic" tone="neutral" label="Calm starter set" />,
    );
    expect(
      screen.getByTestId("baseline-provenance-badge").getAttribute("data-provenance"),
    ).toBe("generic");
  });
});
