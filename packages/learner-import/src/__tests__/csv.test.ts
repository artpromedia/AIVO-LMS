import { describe, it, expect } from "vitest";
import { parseCsv, toCsv } from "../csv.js";

describe("parseCsv", () => {
  it("parses a simple header + rows", () => {
    const p = parseCsv("a,b,c\n1,2,3\n4,5,6");
    expect(p.header).toEqual(["a", "b", "c"]);
    expect(p.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    const p = parseCsv("﻿a,b\n1,2");
    expect(p.header).toEqual(["a", "b"]);
  });

  it("handles CRLF line endings", () => {
    const p = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(p.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("respects quoted fields with embedded commas", () => {
    const p = parseCsv('name,note\n"Doe, Jane","hi, there"');
    expect(p.rows[0]).toEqual(["Doe, Jane", "hi, there"]);
  });

  it("handles escaped double-quotes inside quotes", () => {
    const p = parseCsv('q\n"she said ""hi"""');
    expect(p.rows[0]).toEqual(['she said "hi"']);
  });

  it("handles newlines inside quoted fields", () => {
    const p = parseCsv('a,b\n"line1\nline2",x');
    expect(p.rows).toEqual([["line1\nline2", "x"]]);
  });

  it("skips blank trailing lines", () => {
    const p = parseCsv("a\n1\n\n\n");
    expect(p.rows).toEqual([["1"]]);
  });

  it("returns empty for whitespace-only input", () => {
    expect(parseCsv("   \n  ").rows).toEqual([]);
    expect(parseCsv("").header).toEqual([]);
  });

  it("trims header names but not field values", () => {
    const p = parseCsv(" a , b \n x , y ");
    expect(p.header).toEqual(["a", "b"]);
    expect(p.rows[0]).toEqual([" x ", " y "]);
  });

  it("tracks source line numbers across quoted newlines", () => {
    const p = parseCsv('a\n"x\ny"\nz');
    expect(p.rowLineNumbers[0]).toBe(2);
    expect(p.rowLineNumbers[1]).toBe(4);
  });
});

describe("toCsv", () => {
  it("round-trips and quotes only when needed", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["plain", "has,comma"],
        ['has"quote', "x"],
      ],
    );
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has""quote"');
    const reparsed = parseCsv(csv);
    expect(reparsed.rows[0]).toEqual(["plain", "has,comma"]);
    expect(reparsed.rows[1]).toEqual(['has"quote', "x"]);
  });
});
