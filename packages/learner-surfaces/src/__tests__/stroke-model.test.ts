import { describe, expect, it } from "vitest";
import {
  addStroke,
  appendStrokePoint,
  clearStrokes,
  createStroke,
  exportStrokes,
  undoStroke,
} from "../ink/stroke-model.js";

describe("stroke model", () => {
  it("adds, undoes, clears, and exports strokes", () => {
    const start = createStroke("pencil", { x: 10, y: 20, t: 1000 }, 2, "s1");
    const completed = appendStrokePoint(start, { x: 20, y: 30, t: 1010, pressure: 0.4 });

    const withOne = addStroke([], completed);
    expect(withOne).toHaveLength(1);

    const undone = undoStroke(withOne);
    expect(undone).toHaveLength(0);

    const withTwo = addStroke(withOne, createStroke("eraser", { x: 0, y: 0, t: 2000 }, 8, "s2"));
    const cloned = exportStrokes(withTwo);
    expect(cloned).toEqual(withTwo);
    expect(cloned).not.toBe(withTwo);

    expect(clearStrokes()).toEqual([]);
  });
});
