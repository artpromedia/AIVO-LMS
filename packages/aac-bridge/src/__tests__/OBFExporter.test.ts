import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseOBF, validateOBF } from "../obf/OBFImporter.js";
import { exportToOBF } from "../obf/OBFExporter.js";
import type { SymbolBoard } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures/sample.obf.json"), "utf-8"));

describe("OBFExporter", () => {
  it("exportToOBF produces a valid OBF document (zero validation errors)", () => {
    const board = parseOBF(fixture);
    const exported = exportToOBF(board);
    const errors = validateOBF(exported);
    expect(errors).toHaveLength(0);
  });

  it("round-trip preserves all symbol labels", () => {
    const original = parseOBF(fixture);
    const exported = exportToOBF(original);
    const restored = parseOBF(exported);
    const originalLabels = original.items.map((i) => i.label).sort();
    const restoredLabels = restored.items.map((i) => i.label).sort();
    expect(restoredLabels).toEqual(originalLabels);
  });

  it("round-trip preserves all symbol positions", () => {
    const original = parseOBF(fixture);
    const exported = exportToOBF(original);
    const restored = parseOBF(exported);

    for (const origItem of original.items) {
      const restoredItem = restored.items.find((i) => i.label === origItem.label);
      expect(restoredItem?.position).toEqual(origItem.position);
    }
  });

  it("exportToOBF includes format field set to 'open-board-0.1'", () => {
    const board = parseOBF(fixture);
    const exported = exportToOBF(board) as Record<string, unknown>;
    expect(exported.format).toBe("open-board-0.1");
  });

  it("handles a board with no imageUrls without throwing", () => {
    const board: SymbolBoard = {
      id: "b1",
      name: "No Images",
      locale: "en",
      items: [{ id: "x", label: "X", imageUrl: "", boardId: "b1", position: { row: 0, col: 0 } }],
      grid: { rows: 1, cols: 1 },
    };
    expect(() => exportToOBF(board)).not.toThrow();
  });
});
