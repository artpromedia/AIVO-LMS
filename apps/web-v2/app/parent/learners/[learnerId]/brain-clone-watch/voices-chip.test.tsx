// @vitest-environment jsdom

/**
 * Sprint C-08 — the "N of M voices" chip on the approval ceremony.
 *
 * Substitutes the Playwright runtime walk: asserts the chip shows the partial
 * label when contributed < invited (with a quiet link to the team hub) and the
 * honest zero-contributor label when nobody contributed (and that the hub link
 * still appears so the parent can invite/nudge). Pre-resolved strings are
 * passed in (the page builds them from i18n), so we assert wiring + the link
 * gating, not copy.
 */
import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// next/link → a plain anchor; ConsentRow → a stub. The chip renders in the
// non-confirming default view, so the confirm-step SubmitButton (which reads
// useFormStatus) never mounts and react-dom needs no mocking.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@aivo/ui/auth", () => ({
  ConsentRow: ({ title }: { title: string }) => <div>{title}</div>,
}));

import { ApprovalCeremony, type CeremonyStrings, type CeremonyVoices } from "./approval-ceremony";

const STRINGS: CeremonyStrings = {
  recap: "recap",
  raiToggle: "rai",
  raiClose: "close",
  raiSourcesTitle: "sources",
  raiSourcesEmpty: "empty",
  raiBiasTitle: "bias",
  raiTransparencyTitle: "transparency",
  raiOversightTitle: "oversight",
  consentTitle: "consent",
  consentDesc: "consentDesc",
  gateHint: "gate",
  review: "review",
  confirmTitle: "confirmTitle",
  confirmBody: "confirmBody",
  confirm: "confirm",
  cancel: "cancel",
  hold: "hold",
  holdRelease: "holdRelease",
  holdProgress: "holdProgress",
  submitting: "submitting",
  amendLabel: "amend",
  stagedCorrections: null,
};

const RAI = { sources: [], biasMitigations: [], transparency: "t", humanOversight: "h" };

function renderWith(voices: CeremonyVoices | null) {
  return render(
    <ApprovalCeremony
      learnerId="l1"
      rai={RAI}
      strings={STRINGS}
      voices={voices}
      consentVersion="v1"
      raiVersion="r1"
      approveAction={() => {}}
    />,
  );
}

afterEach(cleanup);

describe("ApprovalCeremony voices chip", () => {
  it("shows the partial label and a link to the hub when contributed < invited", () => {
    renderWith({
      invited: 4,
      contributed: 3,
      label: "Built from 3 of 4 invited voices",
      zeroLabel: "zero",
      linkLabel: "See the team",
      hubHref: "/parent/learners/l1/team",
    });
    expect(screen.getByText("Built from 3 of 4 invited voices")).toBeTruthy();
    const link = screen.getByRole("link", { name: "See the team" });
    expect(link.getAttribute("href")).toBe("/parent/learners/l1/team");
  });

  it("shows the honest zero label (and still links to the hub) when nobody contributed", () => {
    renderWith({
      invited: 2,
      contributed: 0,
      label: "partial-label",
      zeroLabel: "Built from your answers and Sky’s adventure — teammates can still add their view",
      linkLabel: "See the team",
      hubHref: "/parent/learners/l1/team",
    });
    expect(
      screen.getByText(/Built from your answers and Sky’s adventure/),
    ).toBeTruthy();
    expect(screen.queryByText("partial-label")).toBeNull();
    // contributed (0) < invited (2) ⇒ the hub link is present.
    expect(screen.getByRole("link", { name: "See the team" })).toBeTruthy();
  });

  it("hides the hub link when every invited voice has contributed", () => {
    renderWith({
      invited: 2,
      contributed: 2,
      label: "Built from 2 of 2 invited voices",
      zeroLabel: "zero",
      linkLabel: "See the team",
      hubHref: "/parent/learners/l1/team",
    });
    expect(screen.getByText("Built from 2 of 2 invited voices")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "See the team" })).toBeNull();
  });

  it("renders no chip at all when voices is null (nobody invited)", () => {
    renderWith(null);
    expect(screen.queryByText(/Built from/)).toBeNull();
  });
});
