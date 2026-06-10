import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KpiCard } from "../../chart/KpiCard.js";

const SERIES = [
  { label: "W1", value: 42 },
  { label: "W2", value: 48 },
  { label: "W3", value: 55 },
  { label: "W4", value: 61 },
];

describe("KpiCard", () => {
  // ── Core rendering ─────────────────────────────────────────────────────────

  it("renders the required value prop", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Active learners" />,
    );
    expect(html).toContain("240");
  });

  it("renders the label when provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Active learners" />,
    );
    expect(html).toContain("Active learners");
  });

  it("omits the label element when label is not provided", () => {
    const html = renderToStaticMarkup(<KpiCard value="99" />);
    // No <p> label element
    expect(html).not.toContain('<p ');
    // value is still present
    expect(html).toContain("99");
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("renders role=region on the card", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Active learners" />,
    );
    expect(html).toContain('role="region"');
  });

  it("generates aria-label from label + value when ariaLabel not provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Active learners" />,
    );
    expect(html).toContain('aria-label="Active learners: 240"');
  });

  it("uses explicit ariaLabel when provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Active learners" ariaLabel="Current active learner count: 240" />,
    );
    expect(html).toContain("Current active learner count: 240");
  });

  // ── Delta ──────────────────────────────────────────────────────────────────

  it("renders a positive delta with + sign and percentage", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Learners" deltaPct={0.12} />,
    );
    expect(html).toContain("+12%");
  });

  it("renders a negative delta with − sign", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Learners" deltaPct={-0.05} />,
    );
    expect(html).toContain("−5%");
  });

  it("renders zero delta as 0%", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Learners" deltaPct={0} />,
    );
    expect(html).toContain("0%");
  });

  it("does not render delta element when deltaPct is not provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="240" label="Learners" />,
    );
    // No % character in output
    expect(html).not.toContain("%");
  });

  // ── Sparkline + data table ─────────────────────────────────────────────────

  it("renders a sparkline when series is provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="61" label="Score" series={SERIES} />,
    );
    // SoftLine renders an <svg>
    expect(html).toContain("<svg");
  });

  it("renders a visually-hidden data table when series is provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="61" label="Score" series={SERIES} />,
    );
    expect(html).toContain("sr-only");
    expect(html).toContain("Period");
    expect(html).toContain("Value");
  });

  it("includes all series labels and values in the data table", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="61" label="Score" series={SERIES} />,
    );
    expect(html).toContain("W1");
    expect(html).toContain(">42<");
    expect(html).toContain("W4");
    expect(html).toContain(">61<");
  });

  it("does not render data table when series is not provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="61" label="Score" />,
    );
    expect(html).not.toContain("sr-only");
  });

  it("does not render sparkline SVG when series is not provided", () => {
    const html = renderToStaticMarkup(
      <KpiCard value="61" label="Score" />,
    );
    expect(html).not.toContain("<svg");
  });

  // ── Tones ──────────────────────────────────────────────────────────────────

  it("accepts all supported tone values without throwing", () => {
    const tones = ["brand", "mastery", "success", "risk"] as const;
    for (const tone of tones) {
      expect(() =>
        renderToStaticMarkup(<KpiCard value="10" label="Metric" tone={tone} />),
      ).not.toThrow();
    }
  });
});
