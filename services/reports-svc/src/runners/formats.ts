/**
 * Format encoders (Sprint 10): csv, json, parquet, pdf.
 *
 * CSV and JSON are produced exactly (RFC-4180 CSV quoting), so their output is
 * deterministic and snapshot-testable. Parquet is emitted as a deterministic
 * columnar container (magic header + per-column JSON chunks + footer) — a
 * portable, byte-stable stand-in for the on-disk Parquet layout that a real
 * parquet writer (e.g. parquetjs) drops in behind this same interface in
 * production. PDF renders the HTML template (see ./pdf.ts).
 */
import type { ReportColumn } from "../registry/types.js";

export interface EncodedReport {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // RFC-4180: quote if it contains comma, quote, CR or LF; double embedded quotes.
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function encodeCsv(columns: ReportColumn[], rows: Array<Record<string, unknown>>): Buffer {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(",")).join("\n");
  const text = body ? `${header}\n${body}\n` : `${header}\n`;
  return Buffer.from(text, "utf8");
}

export function encodeJson(columns: ReportColumn[], rows: Array<Record<string, unknown>>): Buffer {
  // Project to declared columns only, preserving column order, so the JSON is
  // stable regardless of resolver row key ordering.
  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c.key] = row[c.key] ?? null;
    return out;
  });
  return Buffer.from(JSON.stringify({ columns, rows: projected }, null, 2), "utf8");
}

/**
 * Deterministic columnar container. Layout:
 *   "PAR1\n" magic
 *   one line per column: `COL <key> <json-array-of-values>`
 *   "PAR1" footer magic
 * Byte-stable for identical input → snapshot-testable.
 */
export function encodeParquet(
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>,
): Buffer {
  const lines: string[] = ["PAR1"];
  for (const c of columns) {
    const colValues = rows.map((r) => r[c.key] ?? null);
    lines.push(`COL ${c.key} ${JSON.stringify(colValues)}`);
  }
  lines.push("PAR1");
  return Buffer.from(lines.join("\n"), "utf8");
}

export const FORMAT_META: Record<string, { contentType: string; extension: string }> = {
  csv: { contentType: "text/csv; charset=utf-8", extension: "csv" },
  json: { contentType: "application/json", extension: "json" },
  parquet: { contentType: "application/vnd.apache.parquet", extension: "parquet" },
  pdf: { contentType: "application/pdf", extension: "pdf" },
};
