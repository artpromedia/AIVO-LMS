import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SurfaceRouter } from "../SurfaceRouter/SurfaceRouter.js";

describe("SurfaceRouter", () => {
  it("routes the 5 lesson-player surface types", () => {
    const choiceMarkup = renderToStaticMarkup(
      <SurfaceRouter
        item={{ id: "choice", surfaceType: "choice_grid", prompt: "Pick one", choices: ["A", "B"] }}
        onSubmitAndAdvance={() => {}}
      />,
    );
    const mathMarkup = renderToStaticMarkup(
      <SurfaceRouter
        item={{ id: "math", surfaceType: "math_expression", prompt: "2 + 2", expectedAnswer: "4" }}
        onSubmitAndAdvance={() => {}}
      />,
    );
    const scratchpadMarkup = renderToStaticMarkup(
      <SurfaceRouter
        item={{
          id: "scratch",
          surfaceType: "scratchpad",
          prompt: "Draw",
          scratchpad: { enabled: true },
        }}
        onSubmitAndAdvance={() => {}}
      />,
    );
    const geometryMarkup = renderToStaticMarkup(
      <SurfaceRouter
        item={{
          id: "geo",
          surfaceType: "geometry_workspace",
          prompt: "Move",
          diagram: {
            canvasMode: "svg",
            shapes: [{ id: "rect-1", kind: "rectangle", x: 100, y: 80, width: 80, height: 60 }],
          },
        }}
        onSubmitAndAdvance={() => {}}
      />,
    );
    const numberLineMarkup = renderToStaticMarkup(
      <SurfaceRouter
        item={{
          id: "line",
          surfaceType: "number_line",
          prompt: "Pick",
          numberLine: { min: 0, max: 5, step: 1 },
        }}
        onSubmitAndAdvance={() => {}}
      />,
    );

    expect(choiceMarkup).toContain("choice-grid-surface");
    expect(mathMarkup).toContain("math-expression-surface");
    expect(scratchpadMarkup).toContain("scratchpad-surface");
    expect(geometryMarkup).toContain("geometry-surface");
    expect(numberLineMarkup).toContain("number-line-surface");
  });
});
