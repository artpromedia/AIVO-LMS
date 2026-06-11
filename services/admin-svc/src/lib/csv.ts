/**
 * CSV streaming helpers (Sprint B3) — RFC 4180 escaping, UTF-8 BOM for
 * Excel, and a hard row cap so an export can never become a denial of
 * service. Used by the admin export endpoints.
 */
import type { FastifyReply } from "fastify";

export const EXPORT_ROW_CAP = 100_000;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",") + "\r\n";
}

/** Start a CSV download response and return a row writer. */
export function startCsv(
  reply: FastifyReply,
  filename: string,
  header: string[],
): (values: unknown[]) => void {
  reply.raw.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "no-store",
  });
  reply.raw.write("\uFEFF" + csvRow(header));
  return (values) => {
    reply.raw.write(csvRow(values));
  };
}
