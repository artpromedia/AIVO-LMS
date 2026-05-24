import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SurfaceHost } from "../SurfaceHost.js";
import type { LearnerSurfaceSpec } from "../types.js";

const baseSurface: Omit<LearnerSurfaceSpec, "id" | "type" | "prompt"> = {
  capture: { finalAnswer: true, inkStrokes: true },
  scoring: { mode: "exact" },
  accessibility: {
    altText: "Alt text",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
};

describe("SurfaceHost", () => {
  it("renders scratchpad, geometry, choice-grid, and number-line surfaces", () => {
    const scratchpadMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s1",
          type: "scratchpad",
          prompt: "Draw your work",
          scratchpad: { enabled: true },
        }}
      />,
    );

    const geometryMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s2",
          type: "geometry_workspace",
          prompt: "Find the angle",
          diagram: {
            canvasMode: "svg",
            shapes: [{ id: "c", kind: "circle", cx: 100, cy: 100, r: 20 }],
          },
          scratchpad: { enabled: true },
          answerInput: { type: "number", label: "Angle" },
        }}
      />,
    );

    const choiceMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s3",
          type: "choice_grid",
          prompt: "Pick one",
          choices: [
            { id: "a", label: "Option A" },
            { id: "b", label: "Option B" },
          ],
        }}
      />,
    );

    const numberLineMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s4",
          type: "number_line",
          prompt: "Pick the number",
          numberLine: { min: 0, max: 10, step: 1 },
        }}
      />,
    );

    expect(scratchpadMarkup).toContain("scratchpad-surface");
    expect(geometryMarkup).toContain("geometry-surface");
    expect(choiceMarkup).toContain("choice-grid-surface");
    expect(numberLineMarkup).toContain("number-line-surface");
  });

  it("renders fallback and emits telemetry for unsupported surfaces", () => {
    const events: Array<{ type: string }> = [];

    const unsupportedMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s5",
          type: "graph",
          prompt: "Unsupported",
        }}
        onEvent={(event) => events.push({ type: event.type })}
      />,
    );

    expect(unsupportedMarkup).toContain("Activity type unavailable");
    expect(events.some((event) => event.type === "unsupported_surface")).toBe(true);
  });

  it("renders art canvas surface via drawing canvas router", () => {
    const markup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "art-1",
          type: "art_canvas",
          prompt: "Draw a happy sun",
          artCanvas: {
            width: 320,
            height: 200,
            palette: ["#111111", "#ee5500"],
            highContrastPalette: ["#000000", "#ffffff"],
          },
        }}
      />,
    );

    expect(markup).toContain("drawing-canvas");
    expect(markup).toContain("submit artwork");
  });
});
