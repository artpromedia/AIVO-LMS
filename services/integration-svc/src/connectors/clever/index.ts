/**
 * Sprint 2 — Clever Secure Sync connector.
 *
 * Clever's Data API (v3.0) wraps each record as `{ data: {...}, uri }` and
 * bundles enrollments inside sections (`students[]` / `teachers[]`) rather
 * than as standalone objects, so a section maps to one canonical Class plus
 * N Enrollment records. `fetch` is injectable for fixture-based tests.
 */
import {
  emptySnapshot,
  type RosterSnapshot,
  type Org,
  type User,
  type RoleType,
  type Course,
  type Term,
  type Class,
  type Enrollment,
} from "../../types/canonical.js";

export interface CleverConfig {
  /** Clever API base, default https://api.clever.com */
  baseUrl?: string;
  /** District access token (Bearer). */
  token: string;
  pageSize?: number;
}

type FetchFn = typeof fetch;

const CLEVER_ROLE: Record<string, RoleType> = {
  district_admin: "administrator",
  school_admin: "administrator",
  staff: "aide",
  teacher: "teacher",
  student: "student",
  contact: "guardian",
};

/** Page through a Clever collection (cursor via `?starting_after=`). */
export async function fetchAllClever(
  cfg: CleverConfig,
  path: string,
  fetchImpl: FetchFn = fetch,
): Promise<Array<Record<string, any>>> {
  const base = (cfg.baseUrl ?? "https://api.clever.com").replace(/\/$/, "");
  const limit = cfg.pageSize ?? 1000;
  const out: Array<Record<string, any>> = [];
  let startingAfter: string | undefined;
  for (;;) {
    const url = new URL(`${base}${path}`);
    url.searchParams.set("limit", String(limit));
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);
    const res = await fetchImpl(url.toString(), {
      headers: { authorization: `Bearer ${cfg.token}`, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Clever GET ${path} failed: ${res.status}`);
    const json = (await res.json()) as { data?: Array<{ data: any }> };
    const batch = json.data ?? [];
    for (const item of batch) out.push(item.data);
    if (batch.length < limit || batch.length === 0) break;
    startingAfter = batch[batch.length - 1]?.data?.id;
    if (!startingAfter) break;
  }
  return out;
}

export function mapCleverSchool(r: Record<string, any>): Org {
  return {
    provider: "clever",
    sourcedId: r.id,
    status: "active",
    name: r.name,
    type: "school",
    identifier: r.nces_id || r.sis_id || undefined,
    parentSourcedId: r.district || undefined,
  };
}

export function mapCleverUser(r: Record<string, any>): User {
  const roleKeys = r.roles && typeof r.roles === "object" ? Object.keys(r.roles) : [];
  const roles: RoleType[] = roleKeys.map((k) => CLEVER_ROLE[k] ?? "student");
  const fallback: RoleType = r.type ? (CLEVER_ROLE[r.type] ?? "student") : "student";
  const allRoles = roles.length ? Array.from(new Set(roles)) : [fallback];
  const precedence: RoleType[] = ["administrator", "teacher", "aide", "guardian", "parent", "student"];
  const primaryRole = precedence.find((p) => allRoles.includes(p)) ?? allRoles[0];
  const name = r.name ?? {};
  // School association: a teacher/student has `school`; staff may have `schools`.
  const orgs: string[] = [];
  if (r.school) orgs.push(r.school);
  if (Array.isArray(r.schools)) orgs.push(...r.schools);
  return {
    provider: "clever",
    sourcedId: r.id,
    status: "active",
    enabled: true,
    givenName: name.first ?? r.first_name ?? "",
    familyName: name.last ?? r.last_name ?? "",
    middleName: name.middle || undefined,
    email: r.email || undefined,
    username: r.credentials?.district_username || undefined,
    roles: allRoles,
    primaryRole,
    grades: r.grade ? [r.grade] : [],
    orgSourcedIds: Array.from(new Set(orgs)),
    identifiers: r.sis_id ? { sis: r.sis_id } : undefined,
  };
}

export function mapCleverCourse(r: Record<string, any>): Course {
  return {
    provider: "clever",
    sourcedId: r.id,
    status: "active",
    title: r.name,
    courseCode: r.number || undefined,
    grades: [],
  };
}

export function mapCleverTerm(r: Record<string, any>): Term {
  return {
    provider: "clever",
    sourcedId: r.id,
    status: "active",
    title: r.name,
    type: "term",
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
  };
}

/** A Clever section yields one Class and N enrollments (teachers + students). */
export function mapCleverSection(r: Record<string, any>): {
  cls: Class;
  enrollments: Enrollment[];
} {
  const school = r.school ?? "";
  const cls: Class = {
    provider: "clever",
    sourcedId: r.id,
    status: "active",
    title: r.name,
    classCode: r.section_number || undefined,
    type: "scheduled",
    grades: r.grade ? [r.grade] : [],
    courseSourcedId: r.course || undefined,
    schoolSourcedId: school,
    termSourcedIds: r.term ? [r.term] : [],
    subjects: r.subject ? [r.subject] : [],
    periods: r.period ? [r.period] : [],
  };
  const enrollments: Enrollment[] = [];
  const teachers: string[] = [
    ...(r.teacher ? [r.teacher] : []),
    ...(Array.isArray(r.teachers) ? r.teachers : []),
  ];
  for (const t of Array.from(new Set(teachers))) {
    enrollments.push(enroll(r.id, school, t, "teacher"));
  }
  for (const s of Array.isArray(r.students) ? r.students : []) {
    enrollments.push(enroll(r.id, school, s, "student"));
  }
  return { cls, enrollments };
}

function enroll(classId: string, school: string, userId: string, role: RoleType): Enrollment {
  return {
    provider: "clever",
    sourcedId: `${classId}:${userId}:${role}`,
    status: "active",
    classSourcedId: classId,
    schoolSourcedId: school,
    userSourcedId: userId,
    role,
    primary: role === "teacher" ? true : undefined,
  };
}

export async function extractClever(
  cfg: CleverConfig,
  fetchImpl: FetchFn = fetch,
): Promise<RosterSnapshot> {
  const snap = emptySnapshot("clever");
  snap.orgs = (await fetchAllClever(cfg, "/v3.0/schools", fetchImpl)).map(mapCleverSchool);
  snap.terms = (await fetchAllClever(cfg, "/v3.0/terms", fetchImpl)).map(mapCleverTerm);
  snap.courses = (await fetchAllClever(cfg, "/v3.0/courses", fetchImpl)).map(mapCleverCourse);
  snap.users = (await fetchAllClever(cfg, "/v3.0/users", fetchImpl)).map(mapCleverUser);
  const sections = await fetchAllClever(cfg, "/v3.0/sections", fetchImpl);
  for (const s of sections) {
    const { cls, enrollments } = mapCleverSection(s);
    snap.classes.push(cls);
    snap.enrollments.push(...enrollments);
  }
  return snap;
}
