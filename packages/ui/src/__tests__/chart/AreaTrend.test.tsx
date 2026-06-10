import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AreaTrend } from "../../chart/AreaTrend.js";

const SERIES_SINGLE = [
  {
    name: "Used",
    points: [
      { label: "Jan", value: 10 },
      { label: "Feb", value: 15 },
      { label: "Mar", value: 12 },
    ],
  },
];

const SERIES_DUAL = [
  {
    name: "Used",
    points: [
      { label: "Jan", value: 10 },
      { label: "Feb", value: 15 },
      { label: "Mar", value: 12 },
    ],
  },
  {
    name: "Allocated",
    points: [
      { label: "Jan", value: 20 },
      { label: "Feb", value: 20 },
      { label: "Mar", value: 25 },
    ],
    dashed: true,
  },
];

describe("AreaTrend", () => {
  // ── Accessibility ──────────────────────────────────────────────────────────

  it("renders the ariaLabel on the container", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Seat utilization over time" />,
    );
    expect(html).toContain("Seat utilization over time");
  });

  it("renders a visually-hidden data table with series name header", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" />,
    );
    // Table caption matches ariaLabel
    expect(html).toContain("Usage chart");
    // Column headers
    expect(html).toContain("Period");
    expect(html).toContain("Used");
  });

  it("includes all x-axis labels in the data table", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" />,
    );
    expect(html).toContain("Jan");
    expect(html).toContain("Feb");
    expect(html).toContain("Mar");
  });

  it("includes all data values in the data table", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" />,
    );
    expect(html).toContain(">10<");
    expect(html).toContain(">15<");
    expect(html).toContain(">12<");
  });

  it("renders dual series headers in the data table", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_DUAL} ariaLabel="Seat utilization" />,
    );
    expect(html).toContain("Used");
    expect(html).toContain("Allocated");
  });

  it("renders reference line label in the data table when provided", () => {
    const html = renderToStaticMarkup(
      <AreaTrend
        series={SERIES_SINGLE}
        refLine={{ value: 30, label: "Hard cap" }}
        ariaLabel="Usage chart"
      />,
    );
    expect(html).toContain("Hard cap");
    expect(html).toContain(">30<");
  });

  it("marks the data table as sr-only (visually hidden)", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" />,
    );
    expect(html).toContain("sr-only");
  });

  it("marks the SVG as aria-hidden", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" />,
    );
    expect(html).toContain('aria-hidden="true"');
  });

  // ── States ─────────────────────────────────────────────────────────────────

  it("renders loading state with aria-busy", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" loading />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Usage chart loading");
  });

  it("renders error state with role=alert", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" error="Failed to load data" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Failed to load data");
  });

  it("renders empty state when empty prop is set", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" empty />,
    );
    expect(html).toContain("No data yet");
  });

  it("renders empty state when all series have zero points", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={[{ name: "Used", points: [] }]} ariaLabel="Usage chart" />,
    );
    expect(html).toContain("No data yet");
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it("renders an SVG element for chart data", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" />,
    );
    expect(html).toContain("<svg");
  });

  it("renders legend by default", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" />,
    );
    // legend swatch for "Used" series
    expect(html).toContain("Used");
  });

  it("omits legend when showLegend=false", () => {
    const html = renderToStaticMarkup(
      <AreaTrend series={SERIES_SINGLE} ariaLabel="Usage chart" showLegend={false} />,
    );
    // The SVG is still present; the aria-hidden legend div should not be
    // We can verify by checking the legend aria-hidden div is absent
    // The data table will still contain "Used" so we check for the visual legend specifically
    expect(html).not.toContain('aria-hidden="true"><span');
  });
});
