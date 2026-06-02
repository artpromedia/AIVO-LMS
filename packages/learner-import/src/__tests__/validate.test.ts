import { describe, it, expect } from "vitest";
import {
  detectColumnMapping,
  validateRows,
  validateCsv,
  parseDob,
  ageInYears,
  toErrorReportCsv,
  REQUIRED_FIELDS,
} from "../validate.js";

const NOW = new Date("2026-06-01T00:00:00Z");
const HEADER = [
  "external_id",
  "first_name",
  "last_name",
  "grade",
  "dob",
  "email_parent",
  "language_pref",
  "iep_flag",
  "504_flag",
];

function csv(rows: string[][]): string {
  return [HEADER.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

describe("detectColumnMapping", () => {
  it("maps exact field names", () => {
    const m = detectColumnMapping(HEADER);
    expect(m.external_id).toBe(0);
    expect(m.dob).toBe(4);
    expect(m["504_flag"]).toBe(8);
  });

  it("maps common aliases case/space/punct-insensitively", () => {
    const m = detectColumnMapping([
      "Student ID",
      "First Name",
      "Last Name",
      "Grade Level",
      "Date of Birth",
      "Parent Email",
    ]);
    expect(m.external_id).toBe(0);
    expect(m.first_name).toBe(1);
    expect(m.last_name).toBe(2);
    expect(m.grade).toBe(3);
    expect(m.dob).toBe(4);
    expect(m.email_parent).toBe(5);
  });

  it("leaves unknown columns unmapped", () => {
    const m = detectColumnMapping(["external_id", "mystery"]);
    expect(m.external_id).toBe(0);
    expect(m.first_name).toBeUndefined();
  });
});

describe("parseDob", () => {
  it("accepts ISO yyyy-mm-dd", () => {
    expect(parseDob("2014-09-01")).toBe("2014-09-01");
    expect(parseDob("2014-9-1")).toBe("2014-09-01");
  });
  it("accepts US M/D/YYYY", () => {
    expect(parseDob("9/1/2014")).toBe("2014-09-01");
  });
  it("disambiguates D/M when day > 12", () => {
    expect(parseDob("14/03/2019")).toBe("2019-03-14");
  });
  it("rejects impossible dates", () => {
    expect(parseDob("2014-02-30")).toBeNull();
    expect(parseDob("2014-13-01")).toBeNull();
    expect(parseDob("not-a-date")).toBeNull();
    expect(parseDob("")).toBeNull();
    expect(parseDob("1800-01-01")).toBeNull();
  });
});

describe("ageInYears", () => {
  it("computes whole years, respecting birthday not yet reached", () => {
    expect(ageInYears("2013-06-01", NOW)).toBe(13);
    expect(ageInYears("2013-06-02", NOW)).toBe(12); // birthday tomorrow
  });
});

describe("validateRows — required fields", () => {
  it("accepts a fully valid row", () => {
    const r = validateCsv(
      csv([["S1", "Ada", "Lovelace", "5", "2014-09-01", "p@x.com", "en", "false", "false"]]),
      undefined,
      { now: NOW },
    );
    expect(r.summary.validRows).toBe(1);
    expect(r.summary.errorRows).toBe(0);
    expect(r.valid[0].grade).toBe(5);
    expect(r.valid[0].dob).toBe("2014-09-01");
  });

  it.each(REQUIRED_FIELDS)("errors when required field %s is blank", (field) => {
    const row: Record<string, string> = {
      external_id: "S1",
      first_name: "A",
      last_name: "B",
      grade: "5",
      dob: "2010-01-01",
    };
    row[field] = "";
    const line = HEADER.map((h) => row[h] ?? "");
    const r = validateCsv(csv([line]), undefined, { now: NOW });
    expect(r.summary.errorRows).toBe(1);
    expect(r.issues.some((i) => i.field === field && i.code === "required_missing")).toBe(true);
  });

  it("reports missing required COLUMNS when the header lacks them", () => {
    const text = "first_name,last_name\nAda,Lovelace";
    const r = validateCsv(text, undefined, { now: NOW });
    expect(r.missingColumns).toContain("external_id");
    expect(r.missingColumns).toContain("grade");
    expect(r.summary.validRows).toBe(0);
  });
});

describe("validateRows — hard errors", () => {
  it("flags grade outside 0-12", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "13", "2010-01-01", "", "", "false", "false"]]),
      undefined,
      { now: NOW },
    );
    expect(r.issues.some((i) => i.code === "grade_out_of_range")).toBe(true);
    expect(r.summary.errorRows).toBe(1);
  });

  it("accepts grade 0 and 12 and K", () => {
    const r = validateCsv(
      csv([
        ["S1", "A", "B", "0", "2010-01-01", "p@x.com", "", "false", "false"],
        ["S2", "C", "D", "12", "2010-01-01", "p@x.com", "", "false", "false"],
        ["S3", "E", "F", "K", "2010-01-01", "p@x.com", "", "false", "false"],
      ]),
      undefined,
      { now: NOW },
    );
    expect(r.summary.errorRows).toBe(0);
    expect(r.valid[2].grade).toBe(0); // K -> 0
  });

  it("flags malformed dob", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "5", "31/31/2010", "", "", "false", "false"]]),
      undefined,
      { now: NOW },
    );
    expect(r.issues.some((i) => i.code === "dob_malformed")).toBe(true);
  });

  it("flags duplicate external_id within the file (and keeps the first)", () => {
    const r = validateCsv(
      csv([
        ["DUP", "A", "B", "5", "2010-01-01", "p@x.com", "", "false", "false"],
        ["DUP", "C", "D", "6", "2010-01-01", "p@x.com", "", "false", "false"],
      ]),
      undefined,
      { now: NOW },
    );
    expect(r.issues.some((i) => i.code === "duplicate_external_id")).toBe(true);
    expect(r.summary.errorRows).toBe(1); // second row only
    expect(r.summary.validRows).toBe(1);
  });

  it("flags an invalid parent email", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "5", "2010-01-01", "not-an-email", "", "false", "false"]]),
      undefined,
      { now: NOW },
    );
    expect(r.issues.some((i) => i.code === "email_invalid")).toBe(true);
  });

  it("flags non-boolean flags", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "5", "2010-01-01", "p@x.com", "", "maybe", "kinda"]]),
      undefined,
      { now: NOW },
    );
    expect(r.issues.filter((i) => i.code === "flag_invalid")).toHaveLength(2);
  });
});

describe("validateRows — warnings (non-blocking)", () => {
  it("warns on under-13 with no parent email but keeps the row valid", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "3", "2018-01-01", "", "en", "false", "false"]]),
      undefined,
      { now: NOW },
    );
    expect(
      r.issues.some((i) => i.code === "coppa_missing_parent_email" && i.level === "warning"),
    ).toBe(true);
    expect(r.summary.validRows).toBe(1); // warning doesn't block
    expect(r.summary.warningRows).toBe(1);
  });

  it("does not warn when an over-13 learner has no parent email", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "9", "2008-01-01", "", "en", "false", "false"]]),
      undefined,
      { now: NOW },
    );
    expect(r.issues.some((i) => i.code === "coppa_missing_parent_email")).toBe(false);
  });

  it("does not warn when an under-13 learner has a parent email", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "3", "2018-01-01", "p@x.com", "en", "false", "false"]]),
      undefined,
      { now: NOW },
    );
    expect(r.issues.some((i) => i.code === "coppa_missing_parent_email")).toBe(false);
  });
});

describe("flag parsing", () => {
  it("accepts a variety of truthy/falsy spellings", () => {
    const r = validateCsv(
      csv([["S1", "A", "B", "5", "2010-01-01", "p@x.com", "", "Yes", "N"]]),
      undefined,
      { now: NOW },
    );
    expect(r.valid[0].iep_flag).toBe(true);
    expect(r.valid[0]["504_flag"]).toBe(false);
  });
});

describe("manual column-mapping override", () => {
  it("honors an override when headers are unrecognizable", () => {
    const text = "a,b,c,d,e\nS1,Ada,Lovelace,5,2014-09-01";
    const override = { external_id: 0, first_name: 1, last_name: 2, grade: 3, dob: 4 };
    const r = validateCsv(text, override, { now: NOW });
    expect(r.summary.validRows).toBe(1);
    expect(r.missingColumns).toHaveLength(0);
  });
});

describe("toErrorReportCsv", () => {
  it("emits only rows with issues plus an _issues column", () => {
    const text = csv([
      ["S1", "A", "B", "5", "2010-01-01", "p@x.com", "", "false", "false"], // ok
      ["S2", "C", "D", "99", "bad", "", "", "false", "false"], // errors
    ]);
    const r = validateCsv(text, undefined, { now: NOW });
    const report = toErrorReportCsv(text, r);
    expect(report).toContain("_issues");
    expect(report).toContain("S2");
    expect(report).not.toContain("S1,A,B"); // clean row excluded
  });
});
