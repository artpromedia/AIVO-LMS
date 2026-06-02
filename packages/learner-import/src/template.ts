/**
 * The canonical learner-import CSV template offered for download from the
 * import wizard (Sprint 6 DoD: "CSV template downloadable from the import
 * page"). Header order is the documented one; two example rows show the
 * expected shapes (ISO and US dates, K grade, flags).
 */
import { REQUIRED_FIELDS, OPTIONAL_FIELDS } from "./validate.js";

export const TEMPLATE_HEADER: string[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const EXAMPLE_ROWS: string[][] = [
  ["S1001", "Ada", "Lovelace", "5", "2014-09-01", "parent.ada@example.com", "en", "false", "false"],
  ["S1002", "Niko", "Rivera", "K", "03/14/2019", "", "es", "true", "false"],
];

export function templateCsv(): string {
  const lines = [TEMPLATE_HEADER.join(",")];
  for (const row of EXAMPLE_ROWS) lines.push(row.join(","));
  return lines.join("\r\n");
}
