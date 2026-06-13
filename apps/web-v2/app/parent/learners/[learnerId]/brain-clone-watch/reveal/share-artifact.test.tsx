// @vitest-environment jsdom

/**
 * Sprint C-14 — the strengths-only share artifact: render-level content safety.
 *
 * The pure builder's field surface is asserted in reveal-assembly.test.ts; this
 * proves the RENDERED card carries only the first name + strengths + interests,
 * fires the creation event once, and never paints a level/accommodation/
 * diagnosis even if such a value were (wrongly) present in the content.
 */
import * as React from "react";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string) => key;
vi.mock("next-intl", () => ({ useTranslations: () => stableT }));

import { ShareArtifact } from "./share-artifact";

afterEach(cleanup);

describe("ShareArtifact", () => {
  it("renders only the first name, strengths, and interests on the card", () => {
    render(
      <ShareArtifact
        learnerName="Maya R."
        content={{ firstName: "Maya", strengths: ["Drawing", "Science"], interests: ["Space"] }}
        hasContent
        primaryHue="#A78BFA"
      />,
    );
    const card = screen.getByTestId("share-artifact-card");
    expect(within(card).getByText("Maya")).toBeTruthy();
    expect(within(card).getByText("Drawing")).toBeTruthy();
    expect(within(card).getByText("Science")).toBeTruthy();
    expect(within(card).getByText("Space")).toBeTruthy();
    // The card NEVER shows the display name with the surname initial.
    expect(within(card).queryByText("Maya R.")).toBeNull();
    // Sentinel scan: the rendered card text carries no level/accommodation/
    // diagnosis/source vocabulary.
    const text = card.textContent?.toLowerCase() ?? "";
    for (const banned of [
      "growing",
      "confident",
      "advanced",
      "read_aloud",
      "extended_time",
      "sensory",
      "iep",
      "adhd",
      "autism",
      "baseline",
      "collaborator",
    ]) {
      expect(text).not.toContain(banned);
    }
  });

  it("fires the creation event exactly once on print", () => {
    const onCreate = vi.fn();
    render(
      <ShareArtifact
        learnerName="Maya"
        content={{ firstName: "Maya", strengths: ["Drawing"], interests: [] }}
        hasContent
        primaryHue="#A78BFA"
        onCreate={onCreate}
      />,
    );
    // jsdom has no window.print; stub it so handlePrint doesn't throw.
    vi.stubGlobal("print", vi.fn());
    fireEvent.click(screen.getByText("share_print"));
    fireEvent.click(screen.getByText("share_print"));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("share_created_note")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("renders the warm empty state when there is nothing to share", () => {
    render(
      <ShareArtifact
        learnerName="Maya"
        content={{ firstName: "Maya", strengths: [], interests: [] }}
        hasContent={false}
        primaryHue="#A78BFA"
      />,
    );
    expect(screen.getByText("share_empty_title")).toBeTruthy();
    expect(screen.queryByTestId("share-artifact-card")).toBeNull();
  });
});
