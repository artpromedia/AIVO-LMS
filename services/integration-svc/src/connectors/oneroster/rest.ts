/**
 * Sprint 2 — OneRoster 1.1 / 1.2 REST connector.
 *
 * OAuth2 `client_credentials` for auth, then paged GETs of the Rostering
 * service endpoints, mapped into the canonical {@link RosterSnapshot}.
 * `fetch` and the clock are injectable so the connector is unit-testable
 * against recorded JSON fixtures without a live server.
 *
 * REST JSON differs from the CSV binding (nested GUIDRefs, `roles[]`), so
 * the row mappers here are distinct from `csv.ts` even though both target
 * the same canonical types.
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

export interface OneRosterRestConfig {
  /** Base URL of the Rostering REST service (…/ims/oneroster/v1p1 or v1p2). */
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  /** Page size for list calls. OneRoster caps at 100 for many vendors. */
  pageSize?: number;
}

type FetchFn = typeof fetch;

const ROLE_VALUES: RoleType[] = [
  "administrator",
  "teacher",
  "student",
  "parent",
  "guardian",
  "aide",
  "proctor",
  "relative",
];

function asStatus(v: unknown): EntityStatus {
  return String(v ?? "").toLowerCase() === "tobedeleted" ? "tobedeleted" : "active";
}
function asRole(v: unknown): RoleType {
  const r = String(v ?? "").toLowerCase();
  return (ROLE_VALUES as string[]).includes(r) ? (r as RoleType) : "student";
}
function refId(ref: unknown): string | undefined {
  if (!ref || typeof ref !== "object") return undefined;
  const id = (ref as { sourcedId?: string }).sourcedId;
  return id || undefined;
}
function refIds(refs: unknown): string[] {
  if (!Array.isArray(refs)) return [];
  return refs.map(refId).filter((x): x is string => !!x);
}

/** Acquire an OAuth2 client_credentials access token. */
export async function getAccessToken(
  cfg: OneRosterRestConfig,
  fetchImpl: FetchFn = fetch,
): Promise<string> {
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (cfg.scope) body.set("scope", cfg.scope);
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const res = await fetchImpl(cfg.tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error(`OneRoster token request failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("OneRoster token response missing access_token");
  return json.access_token;
}

/** Page through a OneRoster collection endpoint, collecting all records. */
export async function fetchAll(
  cfg: OneRosterRestConfig,
  token: string,
  path: string,
  collectionKey: string,
  fetchImpl: FetchFn = fetch,
): Promise<Array<Record<string, unknown>>> {
  const limit = cfg.pageSize ?? 100;
  const out: Array<Record<string, unknown>> = [];
  let offset = 0;
  const base = cfg.baseUrl.replace(/\/$/, "");
  for (;;) {
    const url = `${base}${path}?limit=${limit}&offset=${offset}`;
    const res = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`OneRoster GET ${path} failed: ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    const batch = (json[collectionKey] as Array<Record<string, unknown>>) ?? [];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    // Hard stop to avoid an unbounded loop against a misbehaving server.
    if (offset > 5_000_000) break;
  }
  return out;
}

export function mapOrg(r: Record<string, any>): Org {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: asStatus(r.status),
    dateLastModified: r.dateLastModified,
    name: r.name,
    type: (r.type as OrgType) || "school",
    identifier: r.identifier || undefined,
    parentSourcedId: refId(r.parent),
  };
}

export function mapUser(r: Record<string, any>): User {
  let roles: RoleType[] = [];
  if (Array.isArray(r.roles)) roles = r.roles.map((x: any) => asRole(x.role ?? x.roleType));
  if (roles.length === 0 && r.role) roles = [asRole(r.role)];
  if (roles.length === 0) roles = ["student"];
  const precedence: RoleType[] = ["administrator", "teacher", "aide", "guardian", "parent", "student"];
  const primaryRole = precedence.find((p) => roles.includes(p)) ?? roles[0];
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: asStatus(r.status),
    dateLastModified: r.dateLastModified,
    enabled: r.enabledUser !== false && String(r.enabledUser ?? "true") !== "false",
    givenName: r.givenName,
    familyName: r.familyName,
    middleName: r.middleName || undefined,
    email: r.email || undefined,
    username: r.username || undefined,
    roles,
    primaryRole,
    grades: Array.isArray(r.grades) ? r.grades : [],
    orgSourcedIds: refIds(r.orgs),
    identifiers: r.identifier ? { sis: r.identifier } : undefined,
  };
}

export function mapCourse(r: Record<string, any>): Course {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: asStatus(r.status),
    dateLastModified: r.dateLastModified,
    title: r.title,
    courseCode: r.courseCode || undefined,
    grades: Array.isArray(r.grades) ? r.grades : [],
    orgSourcedId: refId(r.org),
    schoolYearSourcedId: refId(r.schoolYear),
  };
}

export function mapTerm(r: Record<string, any>): Term {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: asStatus(r.status),
    dateLastModified: r.dateLastModified,
    title: r.title,
    type: (r.type as SessionType) || "term",
    startDate: r.startDate || undefined,
    endDate: r.endDate || undefined,
    parentSourcedId: refId(r.parent),
    schoolYear: r.schoolYear || undefined,
  };
}

export function mapClass(r: Record<string, any>): Class {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: asStatus(r.status),
    dateLastModified: r.dateLastModified,
    title: r.title,
    classCode: r.classCode || undefined,
    type: (r.classType as ClassType) || "scheduled",
    grades: Array.isArray(r.grades) ? r.grades : [],
    courseSourcedId: refId(r.course),
    schoolSourcedId: refId(r.school) ?? "",
    termSourcedIds: refIds(r.terms),
    subjects: Array.isArray(r.subjects) ? r.subjects : [],
    periods: Array.isArray(r.periods) ? r.periods : [],
  };
}

export function mapEnrollment(r: Record<string, any>): Enrollment {
  return {
    provider: "oneroster",
    sourcedId: r.sourcedId,
    status: asStatus(r.status),
    dateLastModified: r.dateLastModified,
    classSourcedId: refId(r.class) ?? "",
    schoolSourcedId: refId(r.school) ?? "",
    userSourcedId: refId(r.user) ?? "",
    role: asRole(r.role),
    primary: typeof r.primary === "boolean" ? r.primary : undefined,
    beginDate: r.beginDate || undefined,
    endDate: r.endDate || undefined,
  };
}

/** Full extract: token + all collections, mapped to a canonical snapshot. */
export async function extractOneRosterRest(
  cfg: OneRosterRestConfig,
  fetchImpl: FetchFn = fetch,
): Promise<RosterSnapshot> {
  const token = await getAccessToken(cfg, fetchImpl);
  const snap = emptySnapshot("oneroster");
  snap.orgs = (await fetchAll(cfg, token, "/orgs", "orgs", fetchImpl)).map(mapOrg);
  snap.terms = (await fetchAll(cfg, token, "/academicSessions", "academicSessions", fetchImpl)).map(
    mapTerm,
  );
  snap.courses = (await fetchAll(cfg, token, "/courses", "courses", fetchImpl)).map(mapCourse);
  snap.classes = (await fetchAll(cfg, token, "/classes", "classes", fetchImpl)).map(mapClass);
  snap.users = (await fetchAll(cfg, token, "/users", "users", fetchImpl)).map(mapUser);
  snap.enrollments = (await fetchAll(cfg, token, "/enrollments", "enrollments", fetchImpl)).map(
    mapEnrollment,
  );
  return snap;
}
