/**
 * Minimal, dependency-free PDF writer.
 *
 * The platform serves report/invoice PDFs from object storage in production
 * (ADR 0033); in this app we render a small, valid single-page PDF on the fly
 * so downloads work end to end without pulling in a heavy PDF toolchain. This
 * generalizes the ad-hoc invoice renderer (`lib/billing/district-pool.ts`)
 * into a reusable primitive with two fonts, filled rectangles (for bars), and
 * — importantly — **byte-accurate** xref offsets.
 *
 * Font note: the 14 standard PDF fonts (Helvetica here) only cover Latin text,
 * and embedding a Unicode font is out of scope for a no-dependency writer, so
 * `pdfString` transliterates common Latin-1 accents to ASCII and replaces
 * anything it can't represent (e.g. CJK) with "?". Generated documents are
 * therefore English/Latin; on-screen UI localization is unaffected.
 */

export type RGB = readonly [number, number, number]; // each channel 0..1

export interface PdfTextCmd {
  kind: "text";
  /** PDF user space: origin is bottom-left, units are points. */
  x: number;
  y: number;
  size: number;
  text: string;
  bold?: boolean;
  color?: RGB;
}

export interface PdfRectCmd {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  color: RGB;
}

export type PdfCmd = PdfTextCmd | PdfRectCmd;

export interface PdfPageOptions {
  /** Defaults to US Letter (612 × 792 pt). */
  width?: number;
  height?: number;
}

/** US Letter, the report default. */
export const PAGE = { width: 612, height: 792 } as const;

const TRANSLIT: Record<string, string> = {
  À: "A", Á: "A", Â: "A", Ã: "A", Ä: "A", Å: "A", Æ: "AE", Ç: "C",
  È: "E", É: "E", Ê: "E", Ë: "E", Ì: "I", Í: "I", Î: "I", Ï: "I",
  Ñ: "N", Ò: "O", Ó: "O", Ô: "O", Õ: "O", Ö: "O", Ø: "O", Ù: "U",
  Ú: "U", Û: "U", Ü: "U", Ý: "Y", ß: "ss",
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a", æ: "ae", ç: "c",
  è: "e", é: "e", ê: "e", ë: "e", ì: "i", í: "i", î: "i", ï: "i",
  ñ: "n", ò: "o", ó: "o", ô: "o", õ: "o", ö: "o", ø: "o", ù: "u",
  ú: "u", û: "u", ü: "u", ý: "y", ÿ: "y",
  "—": "-", "–": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "...",
};

/** Escape + ASCII-fold a string for a PDF literal `( … )`. */
export function pdfString(s: string): string {
  let out = "";
  for (const ch of s) {
    const mapped = TRANSLIT[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else {
      const code = ch.codePointAt(0) ?? 0;
      out += code >= 0x20 && code <= 0x7e ? ch : "?";
    }
  }
  return out;
}

/** Compact number for the content stream (no trailing zeros). */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

function colorOp([r, g, b]: RGB): string {
  return `${num(r)} ${num(g)} ${num(b)} rg`;
}

function toContent(commands: PdfCmd[]): string {
  const parts: string[] = [];
  for (const c of commands) {
    if (c.kind === "rect") {
      parts.push(colorOp(c.color), `${num(c.x)} ${num(c.y)} ${num(c.w)} ${num(c.h)} re`, "f");
    } else {
      parts.push(
        "BT",
        colorOp(c.color ?? [0, 0, 0]),
        `/${c.bold ? "F2" : "F1"} ${num(c.size)} Tf`,
        `${num(c.x)} ${num(c.y)} Td`,
        `(${pdfString(c.text)}) Tj`,
        "ET",
      );
    }
  }
  return parts.join("\n");
}

/**
 * Render a single-page PDF from drawing commands. Offsets are computed from
 * latin1 byte lengths and all emitted text is ASCII-folded, so the xref table
 * is always exact and the file is a valid PDF.
 */
export function renderPdf(commands: PdfCmd[], opts: PdfPageOptions = {}): Buffer {
  const width = opts.width ?? PAGE.width;
  const height = opts.height ?? PAGE.height;
  const content = toContent(commands);

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      "/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
