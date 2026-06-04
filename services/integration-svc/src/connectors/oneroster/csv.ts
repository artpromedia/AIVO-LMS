/**
 * Sprint 2 — OneRoster 1.1/1.2 CSV bulk-import connector.
 *
 * Parses the OneRoster CSV file set (orgs, academicSessions, courses,
 * classes, users, enrollments, demographics) into a canonical
 * {@link RosterSnapshot}. Dependency-free: includes a small RFC 4180 CSV
 * reader so the connector has no parse-library footprint.
 *
 * Multi-value columns (`orgSourcedIds`, `grades`, `termSourcedIds`, …) are
 * comma-separated *within* a single (usually quoted) CSV field, per the
 * OneRoster CSV binding.
 */
import {
  emptySnapshot,
  type RosterSnapshot,
  type Org,
  type OrgType,
  type User,
  type RoleType,
  type Course,
  type Term,
  type SessionType,
  type Class,
  type ClassType,
  type Enrollment,
  type EntityStatus,
} from "../../types/canonical.js";

/** Parse RFC 4180 CSV text into header-keyed row objects. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, ""); // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

function splitMulti(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function status(v: string | undefined): EntityStatus {
  return (v || "").toLowerCase() === "tobedeleted" ? "tobedeleted" : "active";
}

function mapRole(v: string | undefined): RoleType {
  const r = (v || "").toLowerCase();
  const allowed: RoleType[] = [
    "administrator",
    "teacher",
    "student",
    "parent",
    "guardian",
    "aide",
    "proctor",
    "relative",
  ];
  return (allowed as string[]).includes(r) ? (r as RoleType) : "student";
}

/**
 * OneRoster 1.2 users.csv may carry a JSON `roles` array; 1.1 carries a
 * single `role`. Return all roles plus the primary (first/most-privileged).
 */
function mapUserRoles(rec: Record<string, string>): { roles: RoleType[]; primaryRole: RoleType } {
  let roles: RoleType[] = [];
  if (rec.roles) {
    try {
      const parsed = JSON.parse(rec.roles) as Array<{ role?: string; roleType?: string }>;
      roles = parsed.map((p) => mapRole(p.role ?? p.roleType)).filter(Boolean);
    } catch {
      roles = splitMulti(rec.roles).map(mapRole);
    }
  }
  if (roles.length === 0 && rec.role) roles = [mapRole(rec.role)];
  if (roles.length === 0) roles = ["student"];
  // Precedence for the AIVO provisioning role.
  const precedence: RoleType[] = [
    "administrator",
    "teacher",
    "aide",
    "guardian",
    "parent",
    "student",
  ];
  const primaryRole = precedence.find((p) => roles.includes(p)) ?? roles[0];
  return { roles, primaryRole };
}

function orgFromRow(r: Record<string, string>): Org {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: status(r.status),
    dateLastModified: r.dateLastModified || undefined,
    name: r.name,
    type: (r.type as OrgType) || "school",
    identifier: r.identifier || undefined,
    parentSourcedId: r.parentSourcedId || undefined,
  };
}

function userFromRow(r: Record<string, string>): User {
  const { roles, primaryRole } = mapUserRoles(r);
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: status(r.status),
    dateLastModified: r.dateLastModified || undefined,
    enabled: (r.enabledUser || "true").toLowerCase() !== "false",
    givenName: r.givenName,
    familyName: r.familyName,
    middleName: r.middleName || undefined,
    email: r.email || undefined,
    username: r.username || undefined,
    roles,
    primaryRole,
    grades: splitMulti(r.grades),
    orgSourcedIds: splitMulti(r.orgSourcedIds),
    identifiers: r.identifier ? { sis: r.identifier } : undefined,
  };
}

function courseFromRow(r: Record<string, string>): Course {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: status(r.status),
    dateLastModified: r.dateLastModified || undefined,
    title: r.title,
    courseCode: r.courseCode || undefined,
    grades: splitMulti(r.grades),
    orgSourcedId: r.orgSourcedId || undefined,
    schoolYearSourcedId: r.schoolYearSourcedId || undefined,
  };
}

function termFromRow(r: Record<string, string>): Term {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: status(r.status),
    dateLastModified: r.dateLastModified || undefined,
    title: r.title,
    type: (r.type as SessionType) || "term",
    startDate: r.startDate || undefined,
    endDate: r.endDate || undefined,
    parentSourcedId: r.parentSourcedId || undefined,
    schoolYear: r.schoolYear || undefined,
  };
}

function classFromRow(r: Record<string, string>): Class {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: status(r.status),
    dateLastModified: r.dateLastModified || undefined,
    title: r.title,
    classCode: r.classCode || undefined,
    type: (r.classType as ClassType) || "scheduled",
    grades: splitMulti(r.grades),
    courseSourcedId: r.courseSourcedId || undefined,
    schoolSourcedId: r.schoolSourcedId,
    termSourcedIds: splitMulti(r.termSourcedIds),
    subjects: splitMulti(r.subjects),
    periods: splitMulti(r.periods),
  };
}

function enrollmentFromRow(r: Record<string, string>): Enrollment {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: status(r.status),
    dateLastModified: r.dateLastModified || undefined,
    classSourcedId: r.classSourcedId,
    schoolSourcedId: r.schoolSourcedId,
    userSourcedId: r.userSourcedId,
    role: mapRole(r.role),
    primary: r.primary ? r.primary.toLowerCase() === "true" : undefined,
    beginDate: r.beginDate || undefined,
    endDate: r.endDate || undefined,
  };
}

/** OneRoster CSV file names this connector understands. */
export interface OneRosterCsvFiles {
  orgs?: string;
  academicSessions?: string;
  courses?: string;
  classes?: string;
  users?: string;
  enrollments?: string;
}

/** Parse a OneRoster CSV file set into a canonical snapshot. */
export function parseOneRosterCsv(files: OneRosterCsvFiles): RosterSnapshot {
  const snap = emptySnapshot("oneroster");
  if (files.orgs)
    snap.orgs = parseCsv(files.orgs)
      .filter((r) => r.sourcedId)
      .map(orgFromRow);
  if (files.academicSessions)
    snap.terms = parseCsv(files.academicSessions)
      .filter((r) => r.sourcedId)
      .map(termFromRow);
  if (files.courses)
    snap.courses = parseCsv(files.courses)
      .filter((r) => r.sourcedId)
      .map(courseFromRow);
  if (files.classes)
    snap.classes = parseCsv(files.classes)
      .filter((r) => r.sourcedId)
      .map(classFromRow);
  if (files.users)
    snap.users = parseCsv(files.users)
      .filter((r) => r.sourcedId)
      .map(userFromRow);
  if (files.enrollments)
    snap.enrollments = parseCsv(files.enrollments)
      .filter((r) => r.sourcedId)
      .map(enrollmentFromRow);
  return snap;
}
