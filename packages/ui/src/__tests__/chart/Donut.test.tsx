import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Donut } from "../../chart/Donut.js";

const SEGMENTS = [
  { label: "Reading", value: 40 },
  { label: "Math", value: 35 },
  { label: "Science", value: 25 },
];

describe("Donut", () => {
  // ── Accessibility ──────────────────────────────────────────────────────────

  it("renders the ariaLabel as table caption", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain("Subject breakdown");
  });

  it("renders a visually-hidden data table with correct headers", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain("Category");
    expect(html).toContain("Value");
    expect(html).toContain("Percentage");
  });

  it("includes all segment labels in the data table", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain("Reading");
    expect(html).toContain("Math");
    expect(html).toContain("Science");
  });

  it("includes all segment values in the data table", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain(">40<");
    expect(html).toContain(">35<");
    expect(html).toContain(">25<");
  });

  it("includes computed percentages in the data table", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    // 40/100 = 40%, 35/100 = 35%, 25/100 = 25%
    expect(html).toContain("40%");
    expect(html).toContain("35%");
    expect(html).toContain("25%");
  });

  it("marks the data table as sr-only (visually hidden)", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain("sr-only");
  });

  it("marks the SVG as aria-hidden", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain('aria-hidden="true"');
  });

  // ── Center total ───────────────────────────────────────────────────────────

  it("renders the sum of all segments as center label by default", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    // Sum = 40 + 35 + 25 = 100
    expect(html).toContain(">100<");
  });

  it("renders a custom centerLabel when provided", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" centerLabel="100 total" />,
    );
    expect(html).toContain("100 total");
  });

  // ── States ─────────────────────────────────────────────────────────────────

  it("renders loading state with aria-busy", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" loading />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Subject breakdown loading");
  });

  it("renders error state with role=alert", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" error="Failed to load" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Failed to load");
  });

  it("renders empty state when empty prop is set", () => {
    const html = renderToStaticMarkup(
      <Donut segments={[]} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain("No data yet");
  });

  it("renders empty state when segments array is empty", () => {
    const html = renderToStaticMarkup(
      <Donut segments={[]} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain("No data yet");
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders an SVG element for chart data", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    expect(html).toContain("<svg");
  });

  it("renders a <path> for each segment", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    // Three segments → three path elements
    const pathCount = (html.match(/<path /g) ?? []).length;
    expect(pathCount).toBe(3);
  });

  it("renders legend by default with segment labels", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" />,
    );
    // legend is aria-hidden but contains the labels
    expect(html).toContain("Reading");
    expect(html).toContain("Math");
  });

  it("omits the visual legend when showLegend=false", () => {
    const html = renderToStaticMarkup(
      <Donut segments={SEGMENTS} ariaLabel="Subject breakdown" showLegend={false} />,
    );
    // No <ul> legend element
    expect(html).not.toContain("<ul");
  });
});
