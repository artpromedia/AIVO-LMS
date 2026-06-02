import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, parseOneRosterCsv } from "../connectors/oneroster/csv.js";

const DIR = join(__dirname, "../../tests/fixtures/oneroster_v1p2");
const read = (f: string) => readFileSync(join(DIR, f), "utf8");

const files = {
  orgs: read("orgs.csv"),
  academicSessions: read("academicSessions.csv"),
  courses: read("courses.csv"),
  classes: read("classes.csv"),
  users: read("users.csv"),
  enrollments: read("enrollments.csv"),
};

describe("OneRoster CSV parser", () => {
  it("parses quoted fields containing commas", () => {
    const rows = parseCsv('a,b,c\n1,"x,y",3\n');
    expect(rows).toEqual([{ a: "1", b: "x,y", c: "3" }]);
  });

  it("handles escaped double-quotes", () => {
    const rows = parseCsv('a\n"he said ""hi"""\n');
    expect(rows[0].a).toBe('he said "hi"');
  });
});

describe("OneRoster CSV connector → canonical", () => {
  const snap = parseOneRosterCsv(files);

  it("maps orgs with parent refs and types", () => {
    expect(snap.orgs).toHaveLength(3);
    const dist = snap.orgs.find((o) => o.sourcedId === "dist-1")!;
    expect(dist.type).toBe("district");
    expect(snap.orgs.find((o) => o.sourcedId === "sch-1")!.parentSourcedId).toBe("dist-1");
  });

  it("splits multi-value orgSourcedIds and maps roles", () => {
    const s2 = snap.users.find((u) => u.sourcedId === "usr-s2")!;
    expect(s2.orgSourcedIds).toEqual(["sch-1", "sch-2"]);
    expect(s2.primaryRole).toBe("student");
    const t1 = snap.users.find((u) => u.sourcedId === "usr-t1")!;
    expect(t1.primaryRole).toBe("teacher");
    expect(t1.roles).toContain("teacher");
  });

  it("carries tobedeleted status through for the diff stage", () => {
    const gone = snap.users.find((u) => u.sourcedId === "usr-s3")!;
    expect(gone.status).toBe("tobedeleted");
    expect(gone.enabled).toBe(false);
  });

  it("maps classes, courses, terms, enrollments", () => {
    expect(snap.classes).toHaveLength(2);
    expect(snap.classes[0].schoolSourcedId).toBe("sch-1");
    expect(snap.classes[0].termSourcedIds).toEqual(["term-fall"]);
    expect(snap.courses).toHaveLength(1);
    expect(snap.terms).toHaveLength(2);
    expect(snap.enrollments).toHaveLength(3);
    const teach = snap.enrollments.find((e) => e.userSourcedId === "usr-t1")!;
    expect(teach.role).toBe("teacher");
    expect(teach.primary).toBe(true);
  });
});
