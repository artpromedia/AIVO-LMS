import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BreakCard } from "../../baseline/BreakCard.js";

/**
 * C-09 — the struggle-triggered break must explain itself gently, while the
 * routine cadence break keeps its existing copy. The copy itself is supplied
 * by the host (i18n); these tests pin the variant behaviour and the no-shame
 * contract (the card never renders a wrong-answer count).
 */

describe("BreakCard — cadence variant (default)", () => {
  const html = renderToStaticMarkup(
    <BreakCard learnerName="Sky" answered={5} total={20} resume={<button>Resume</button>} />,
  );

  it("keeps the existing 'Nice work … take a breath' headline", () => {
    expect(html).toContain("Nice work,");
    expect(html).toContain("take a breath");
  });

  it("keeps the existing calm default body", () => {
    expect(html).toContain("Stretch, sip some water");
  });

  it("marks itself as the cadence variant", () => {
    expect(html).toContain('data-variant="cadence"');
  });
});

describe("BreakCard — struggle variant", () => {
  const struggleBody =
    "Some of those were tricky — that's exactly when a breath helps.";
  const html = renderToStaticMarkup(
    <BreakCard
      variant="struggle"
      title="Let's take a breath together."
      body={struggleBody}
      answered={3}
      total={20}
      resume={<button>Resume</button>}
    />,
  );

  it("marks itself as the struggle variant", () => {
    expect(html).toContain('data-variant="struggle"');
  });

  it("renders the host-supplied gentle title + body", () => {
    expect(html).toContain("Let&#x27;s take a breath together.");
    expect(html).toContain("that&#x27;s exactly when a breath helps");
  });

  it("never names a wrong-answer count or implies failure", () => {
    // Shame-free contract: no "wrong", no "incorrect", no "X of Y wrong".
    expect(html.toLowerCase()).not.toContain("wrong");
    expect(html.toLowerCase()).not.toContain("incorrect");
    expect(html.toLowerCase()).not.toContain("missed");
  });

  it("falls back to a gentle built-in headline when no title is supplied", () => {
    const fallback = renderToStaticMarkup(
      <BreakCard variant="struggle" answered={3} total={20} resume={<button>Resume</button>} />,
    );
    expect(fallback).toContain("take a breath together");
    // Even the fallback must not imply wrongness.
    expect(fallback.toLowerCase()).not.toContain("wrong");
  });
});
