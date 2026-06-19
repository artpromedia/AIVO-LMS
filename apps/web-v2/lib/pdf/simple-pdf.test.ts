/**
 * Unit tests for the dependency-free PDF writer (`lib/pdf/simple-pdf.ts`).
 *
 * The critical invariant is structural validity — a wrong xref byte offset
 * makes the file unopenable — so we parse the emitted xref table and assert
 * every offset actually points at its object. Also covers text escaping,
 * Latin-1 transliteration, and the two fonts.
 */
import { describe, it, expect } from "vitest";
import { renderPdf, pdfString, type PdfCmd } from "./simple-pdf";

describe("pdfString", () => {
  it("escapes PDF-literal metacharacters", () => {
    expect(pdfString("a (b) \\c")).toBe("a \\(b\\) \\\\c");
  });
  it("transliterates Latin-1 accents and typographic punctuation to ASCII", () => {
    expect(pdfString("José Ñoño — “ok”")).toBe('Jose Nono - "ok"');
  });
  it("replaces glyphs the standard font cannot render with '?'", () => {
    expect(pdfString("日本語")).toBe("???");
  });
});

describe("renderPdf", () => {
  const buf = renderPdf([
    { kind: "text", x: 50, y: 700, size: 20, text: "Hello (world)", bold: true },
    { kind: "rect", x: 50, y: 600, w: 200, h: 8, color: [0.5, 0.25, 0.9] },
    { kind: "text", x: 50, y: 580, size: 11, text: "café", color: [0.1, 0.1, 0.1] },
  ]);
  const s = buf.toString("latin1");

  it("emits a structurally complete PDF", () => {
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/BaseFont /Helvetica");
    expect(s).toContain("/BaseFont /Helvetica-Bold");
  });

  it("renders text (escaped/folded) and rectangle ops in the content stream", () => {
    expect(s).toContain("(Hello \\(world\\)) Tj");
    expect(s).toContain("(cafe) Tj"); // é folded
    expect(s).toContain("200 8 re");
    expect(s).toMatch(/0\.5 0\.25 0\.9 rg/);
  });

  it("writes a byte-accurate xref table (every offset points at its object)", () => {
    const m = s.match(/startxref\n(\d+)\n%%EOF$/);
    expect(m).not.toBeNull();
    const xrefStart = Number(m![1]);
    expect(s.slice(xrefStart, xrefStart + 4)).toBe("xref");

    const xrefLines = s.slice(xrefStart).split("\n");
    // xrefLines: ["xref", "0 7", "0000000000 65535 f ", <obj1>, ... <obj6>]
    expect(xrefLines[1]).toBe("0 7");
    for (let obj = 1; obj <= 6; obj += 1) {
      const offset = Number(xrefLines[2 + obj].slice(0, 10));
      expect(s.slice(offset, offset + `${obj} 0 obj`.length)).toBe(`${obj} 0 obj`);
    }
  });

  it("keeps the declared content /Length equal to the real stream byte length", () => {
    const lenMatch = s.match(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/);
    expect(lenMatch).not.toBeNull();
    const declared = Number(lenMatch![1]);
    expect(Buffer.byteLength(lenMatch![2], "latin1")).toBe(declared);
  });

  it("respects a custom page size", () => {
    const cmds: PdfCmd[] = [{ kind: "text", x: 10, y: 10, size: 8, text: "x" }];
    expect(renderPdf(cmds, { width: 300, height: 400 }).toString("latin1")).toContain(
      "/MediaBox [0 0 300 400]",
    );
  });
});
