import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderGeometrySvg } from "../geometry/renderGeometrySvg.js";

describe("renderGeometrySvg", () => {
  it("renders triangle, circle, angle, and labels deterministically", () => {
    const markup = renderToStaticMarkup(
      renderGeometrySvg({
        accessibility: {
          altText: "Sample geometry diagram",
          reduceMotionSafe: true,
          keyboardAlternative: true,
        },
        diagram: {
          canvasMode: "svg",
          coordinateSystem: "cartesian",
          width: 400,
          height: 260,
          shapes: [
            {
              id: "tri",
              kind: "triangle",
              points: [
                { x: 20, y: 200 },
                { x: 100, y: 40 },
                { x: 180, y: 200 },
              ],
            },
            { id: "circ", kind: "circle", cx: 280, cy: 120, r: 40 },
            {
              id: "ang",
              kind: "angle",
              vertex: { x: 220, y: 220 },
              armA: { x: 300, y: 220 },
              armB: { x: 260, y: 150 },
              label: "θ",
            },
          ],
          labels: [{ id: "l1", text: "A", position: { x: 15, y: 215 } }],
          measurements: [{ id: "m1", text: "45°", position: { x: 250, y: 185 } }],
        },
      }),
    );

    expect(markup).toContain("<polygon");
    expect(markup).toContain("<circle");
    expect(markup).toContain("<path");
    expect(markup).toContain(">A<");
    expect(markup).toContain(">45°<");
    expect(markup).toContain("<title>Sample geometry diagram</title>");
  });
});
