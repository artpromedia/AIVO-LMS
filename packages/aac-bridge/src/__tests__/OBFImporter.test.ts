import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseOBF, validateOBF } from "../obf/OBFImporter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures/sample.obf.json"), "utf-8"));

describe("OBFImporter", () => {
  it("parses fixture OBF and returns a SymbolBoard with correct item count", () => {
    const board = parseOBF(fixture);
    expect(board.id).toBe("test-board-1");
    expect(board.name).toBe("Test Board");
    expect(board.locale).toBe("en");
    // 3 buttons (none hidden)
    expect(board.items).toHaveLength(3);
  });

  it("assigns correct labels to items", () => {
    const board = parseOBF(fixture);
    const labels = board.items.map((i) => i.label).sort();
    expect(labels).toEqual(["Hello", "No", "Yes"]);
  });

  it("resolves image URLs for buttons that have image_id", () => {
    const board = parseOBF(fixture);
    const hello = board.items.find((i) => i.label === "Hello");
    expect(hello?.imageUrl).toContain("cdn.example.com");
  });

  it("maps grid positions from the OBF order matrix", () => {
    const board = parseOBF(fixture);
    const hello = board.items.find((i) => i.label === "Hello");
    expect(hello?.position).toEqual({ row: 0, col: 0 });
    const no = board.items.find((i) => i.label === "No");
    expect(no?.position).toEqual({ row: 1, col: 0 });
  });

  it("validateOBF returns empty array for a valid OBF document", () => {
    expect(validateOBF(fixture)).toHaveLength(0);
  });

  it("validateOBF returns error when 'buttons' field is missing", () => {
    const invalid = { id: "x", name: "Bad", grid: { rows: 1, columns: 1 } };
    const errors = validateOBF(invalid);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/buttons/i);
  });

  it("parseOBF throws when OBF is invalid", () => {
    expect(() => parseOBF({ id: "x" })).toThrow(/Invalid OBF/);
  });
});
