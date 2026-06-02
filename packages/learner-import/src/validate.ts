/**
 * Learner-CSV column mapping + row validation (Sprint 6).
 *
 * Encodes the sprint's validation contract exactly:
 *   Required: external_id, first_name, last_name, grade, dob.
 *   Optional: email_parent, language_pref, iep_flag, 504_flag.
 *   Hard error: malformed dob, grade outside 0-12, duplicate external_id
 *     within the file.
 *   Warning: missing parent email when the learner is under 13 (COPPA).
 *
 * Pure and deterministic so the wizard preview, the BFF, and admin-svc all
 * agree on what is an error vs a warning.
 */
import { parseCsv, toCsv } from "./csv.js";

export const REQUIRED_FIELDS = ["external_id", "first_name", "last_name", "grade", "dob"] as const;

export const OPTIONAL_FIELDS = ["email_parent", "language_pref", "iep_flag", "504_flag"] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];
export type OptionalField = (typeof OPTIONAL_FIELDS)[number];
export type LearnerField = RequiredField | OptionalField;

export const ALL_FIELDS: LearnerField[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

/** Header aliases we auto-detect, normalized (lowercase, non-alnum stripped). */
const FIELD_ALIASES: Record<LearnerField, string[]> = {
  external_id: ["externalid", "studentid", "sisid", "id", "studentnumber"],
  first_name: ["firstname", "first", "givenname", "fname"],
  last_name: ["lastname", "last", "surname", "familyname", "lname"],
  grade: ["grade", "gradelevel", "yearlevel"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  email_parent: ["emailparent", "parentemail", "guardianemail", "parentemailaddress"],
  language_pref: ["languagepref", "language", "preferredlanguage", "homelanguage"],
  iep_flag: ["iepflag", "iep", "hasiep"],
  "504_flag": ["504flag", "504", "section504", "has504"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type ColumnMapping = Partial<Record<LearnerField, number>>;

/**
 * Auto-detect a column mapping from a header row. Returns the best-guess
 * `field -> column index` map; callers can override before validating.
 */
export function detectColumnMapping(header: string[]): ColumnMapping {
  const normalized = header.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  for (const field of ALL_FIELDS) {
    const aliases = FIELD_ALIASES[field];
    // Exact normalized field name wins, then alias list, first match.
    let idx = normalized.indexOf(normalizeHeader(field));
    if (idx === -1) {
      idx = normalized.findIndex((h) => aliases.includes(h));
    }
    if (idx !== -1) mapping[field] = idx;
  }
  return mapping;
}

export type IssueLevel = "error" | "warning";

export interface RowIssue {
  /** 1-based index among data rows (not source line). */
  rowNumber: number;
  /** Source line number in the uploaded file, when known. */
  lineNumber?: number;
  field: LearnerField | "row";
  level: IssueLevel;
  code: string;
  message: string;
}

export interface NormalizedLearner {
  rowNumber: number;
  external_id: string;
  first_name: string;
  last_name: string;
  grade: number;
  dob: string; // ISO yyyy-mm-dd
  email_parent: string | null;
  language_pref: string | null;
  iep_flag: boolean;
  "504_flag": boolean;
}

export interface ValidationResult {
  mapping: ColumnMapping;
  /** Required-field columns that the mapping could not locate. */
  missingColumns: RequiredField[];
  valid: NormalizedLearner[];
  issues: RowIssue[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
  };
}

const TRUE_VALUES = new Set(["true", "t", "yes", "y", "1", "x"]);
const FALSE_VALUES = new Set(["false", "f", "no", "n", "0", ""]);

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return null;
}

/**
 * Parse a date of birth in the common SIS shapes (ISO, US, EU) into a
 * canonical ISO `yyyy-mm-dd`. Returns null for anything implausible.
 */
export function parseDob(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    y = +match[1];
    m = +match[2];
    d = +match[3];
  } else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    // Ambiguous M/D vs D/M: if first > 12 it must be the day.
    const a = +match[1];
    const b = +match[2];
    y = +match[3];
    if (a > 12) {
      d = a;
      m = b;
    } else {
      m = a;
      d = b;
    }
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 1900 || y > new Date().getFullYear()) return null;
  // Round-trip through Date to reject e.g. Feb 30.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Whole years from `dob` to `asOf`. */
export function ageInYears(dobIso: string, asOf: Date = new Date()): number {
  const dob = new Date(`${dobIso}T00:00:00Z`);
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const mDiff = asOf.getUTCMonth() - dob.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && asOf.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

function cell(row: string[], mapping: ColumnMapping, field: LearnerField): string {
  const idx = mapping[field];
  if (idx === undefined) return "";
  return (row[idx] ?? "").trim();
}

export interface ValidateOptions {
  /** Reference date for COPPA age math (defaults to now). */
  now?: Date;
}

/**
 * Validate parsed CSV rows against a column mapping. Returns normalized
 * valid learners, plus the full issue list (errors and warnings). A row
 * with any error is excluded from `valid`; a row with only warnings is
 * still valid (warnings don't block import).
 */
export function validateRows(
  rows: string[][],
  mapping: ColumnMapping,
  rowLineNumbers: number[] = [],
  options: ValidateOptions = {},
): ValidationResult {
  const now = options.now ?? new Date();
  const issues: RowIssue[] = [];
  const valid: NormalizedLearner[] = [];

  const missingColumns = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined);

  const seenExternalIds = new Map<string, number>(); // id -> first rowNumber
  const rowsWithError = new Set<number>();
  const rowsWithWarning = new Set<number>();

  rows.forEach((row, i) => {
    const rowNumber = i + 1;
    const lineNumber = rowLineNumbers[i];
    const addIssue = (
      field: RowIssue["field"],
      level: IssueLevel,
      code: string,
      message: string,
    ) => {
      issues.push({ rowNumber, lineNumber, field, level, code, message });
      if (level === "error") rowsWithError.add(rowNumber);
      else rowsWithWarning.add(rowNumber);
    };

    // Required presence.
    for (const f of REQUIRED_FIELDS) {
      if (mapping[f] === undefined) continue; // missingColumns already flags this
      if (cell(row, mapping, f) === "") {
        addIssue(f, "error", "required_missing", `Missing required ${f}`);
      }
    }

    const externalId = cell(row, mapping, "external_id");
    if (externalId !== "") {
      const prev = seenExternalIds.get(externalId);
      if (prev !== undefined) {
        addIssue(
          "external_id",
          "error",
          "duplicate_external_id",
          `Duplicate external_id "${externalId}" (first seen on row ${prev})`,
        );
      } else {
        seenExternalIds.set(externalId, rowNumber);
      }
    }

    // grade 0-12
    const gradeRaw = cell(row, mapping, "grade");
    let grade = NaN;
    if (gradeRaw !== "") {
      const normalized = gradeRaw.toUpperCase();
      grade = normalized === "K" || normalized === "KG" ? 0 : Number(gradeRaw);
      if (!Number.isInteger(grade) || grade < 0 || grade > 12) {
        addIssue("grade", "error", "grade_out_of_range", `Grade "${gradeRaw}" is outside 0-12`);
      }
    }

    // dob
    const dobRaw = cell(row, mapping, "dob");
    let dobIso: string | null = null;
    if (dobRaw !== "") {
      dobIso = parseDob(dobRaw);
      if (dobIso === null) {
        addIssue("dob", "error", "dob_malformed", `Malformed date of birth "${dobRaw}"`);
      }
    }

    // optional flags
    const iepRaw = cell(row, mapping, "iep_flag");
    const iep = parseBool(iepRaw);
    if (iep === null)
      addIssue("iep_flag", "error", "flag_invalid", `iep_flag "${iepRaw}" is not a boolean`);
    const f504Raw = cell(row, mapping, "504_flag");
    const f504 = parseBool(f504Raw);
    if (f504 === null)
      addIssue("504_flag", "error", "flag_invalid", `504_flag "${f504Raw}" is not a boolean`);

    const parentEmail = cell(row, mapping, "email_parent");
    if (parentEmail !== "" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parentEmail)) {
      addIssue("email_parent", "error", "email_invalid", `Invalid parent email "${parentEmail}"`);
    }

    // COPPA warning: under-13 with no parent email.
    if (dobIso && parentEmail === "" && ageInYears(dobIso, now) < 13) {
      addIssue(
        "email_parent",
        "warning",
        "coppa_missing_parent_email",
        "Learner is under 13 (COPPA) but has no parent email",
      );
    }

    if (!rowsWithError.has(rowNumber) && missingColumns.length === 0) {
      valid.push({
        rowNumber,
        external_id: externalId,
        first_name: cell(row, mapping, "first_name"),
        last_name: cell(row, mapping, "last_name"),
        grade,
        dob: dobIso!,
        email_parent: parentEmail || null,
        language_pref: cell(row, mapping, "language_pref") || null,
        iep_flag: iep ?? false,
        "504_flag": f504 ?? false,
      });
    }
  });

  return {
    mapping,
    missingColumns,
    valid,
    issues,
    summary: {
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: rowsWithError.size,
      warningRows: rowsWithWarning.size,
    },
  };
}

/** Parse + auto-map + validate in one call (the BFF "validate" entrypoint). */
export function validateCsv(
  text: string,
  overrides?: ColumnMapping,
  options?: ValidateOptions,
): ValidationResult {
  const parsed = parseCsv(text);
  const mapping = { ...detectColumnMapping(parsed.header), ...(overrides ?? {}) };
  return validateRows(parsed.rows, mapping, parsed.rowLineNumbers, options);
}

/**
 * Build a downloadable error-report CSV: the original row data plus a
 * trailing column listing the issues for that row. Only rows with issues
 * are included.
 */
export function toErrorReportCsv(text: string, result: ValidationResult): string {
  const parsed = parseCsv(text);
  const byRow = new Map<number, RowIssue[]>();
  for (const issue of result.issues) {
    const list = byRow.get(issue.rowNumber) ?? [];
    list.push(issue);
    byRow.set(issue.rowNumber, list);
  }
  const header = [...parsed.header, "_row", "_issues"];
  const rows: string[][] = [];
  for (const [rowNumber, list] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    const source = parsed.rows[rowNumber - 1] ?? [];
    const summary = list.map((x) => `${x.level.toUpperCase()}:${x.field}:${x.message}`).join(" | ");
    rows.push([...source, String(rowNumber), summary]);
  }
  return toCsv(header, rows);
}
