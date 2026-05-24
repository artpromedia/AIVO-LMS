import { describe, expect, it } from "vitest";
import { buildDrawingPngDataUrl, buildDrawingSvg, buildDrawingSvgDataUrl } from "../DrawingCanvas/exportDrawing.js";
import { createStroke } from "../ink/stroke-model.js";

describe("drawing exports", () => {
  const stroke = createStroke(
    "pencil",
    { x: 10, y: 20, t: Date.now() },
    3,
    "stroke-1",
    "#ff0000",
  );

  it("builds svg output with path data", () => {
    const svg = buildDrawingSvg([stroke], 120, 80);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
    expect(svg).toContain("#ff0000");
  });

  it("builds svg and png data urls", async () => {
    const svgUrl = buildDrawingSvgDataUrl([stroke], 120, 80);
    const pngUrl = await buildDrawingPngDataUrl([stroke], 120, 80);

    expect(svgUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(pngUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
