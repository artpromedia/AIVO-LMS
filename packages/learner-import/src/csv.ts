/**
 * Minimal, dependency-free RFC-4180-ish CSV parser (Sprint 6).
 *
 * Handles the messy realities of files exported from a SIS by a harried
 * office admin: a UTF-8 BOM, CRLF or LF line endings, quoted fields with
 * embedded commas / quotes / newlines, and trailing blank lines. No
 * external dependency so it runs identically in the browser wizard, the
 * BFF, and admin-svc.
 */

export interface ParsedCsv {
  header: string[];
  /** Data rows (header excluded), each a parallel array to `header`. */
  rows: string[][];
  /** 1-based source line number for each data row (for error reporting). */
  rowLineNumbers: number[];
}

/** Strip a leading UTF-8 BOM if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Tokenize CSV text into records (arrays of field strings). Tracks the
 * source line each record started on so callers can point a user at the
 * exact row in their file even when a quoted field spanned newlines.
 */
function tokenize(text: string): { records: string[][]; startLines: number[] } {
  const records: string[][] = [];
  const startLines: number[] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let recordHasContent = false;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    startLines.push(recordStartLine);
    record = [];
    recordHasContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      recordHasContent = true;
      continue;
    }
    if (ch === ",") {
      pushField();
      recordHasContent = true;
      continue;
    }
    if (ch === "\r") {
      // swallow; the \n (or EOF) ends the record
      continue;
    }
    if (ch === "\n") {
      if (recordHasContent || record.length > 0 || field.length > 0) {
        pushRecord();
      }
      line++;
      recordStartLine = line;
      continue;
    }
    field += ch;
    recordHasContent = true;
  }
  // Trailing field/record with no terminating newline.
  if (field.length > 0 || record.length > 0 || recordHasContent) {
    pushRecord();
  }
  return { records, startLines };
}

export function parseCsv(text: string): ParsedCsv {
  const clean = stripBom(text ?? "");
  if (clean.trim().length === 0) {
    return { header: [], rows: [], rowLineNumbers: [] };
  }
  const { records, startLines } = tokenize(clean);
  if (records.length === 0) {
    return { header: [], rows: [], rowLineNumbers: [] };
  }
  const header = records[0].map((h) => h.trim());
  const rows: string[][] = [];
  const rowLineNumbers: number[] = [];
  for (let i = 1; i < records.length; i++) {
    // Skip fully-empty rows (a lone empty field from a blank line).
    if (records[i].length === 1 && records[i][0].trim() === "") continue;
    rows.push(records[i]);
    rowLineNumbers.push(startLines[i]);
  }
  return { header, rows, rowLineNumbers };
}

/** Quote a single field for CSV output when it needs it. */
export function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize a header + rows back to CSV text (used for the error report). */
export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(csvField).join(",")];
  for (const row of rows) lines.push(row.map(csvField).join(","));
  return lines.join("\r\n");
}
