/**
 * Sprint 2 — canonicalization / normalization stage.
 *
 * Connectors emit canonical-shaped records, but with provider-specific
 * ordering and casing. `normalizeSnapshot` produces a deterministic,
 * stable form so the diff stage compares apples to apples:
 *   - entity lists sorted by sourcedId,
 *   - duplicate sourcedIds collapsed (last-write-wins),
 *   - multi-value arrays sorted + de-duped,
 *   - emails lower-cased, whitespace trimmed.
 *
 * Normalization is idempotent — `normalize(normalize(s))` deep-equals
 * `normalize(s)` — which the property test pins.
 */
import type {
  RosterSnapshot,
  Org,
  User,
  Course,
  Term,
  Class,
  Enrollment,
} from "../types/canonical.js";

function uniqSort(arr: string[] | undefined): string[] {
  if (!arr || arr.length === 0) return [];
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))).sort();
}

function bySourcedId<T extends { sourcedId: string }>(a: T, b: T): number {
  return a.sourcedId < b.sourcedId ? -1 : a.sourcedId > b.sourcedId ? 1 : 0;
}

/** Collapse duplicate sourcedIds (last wins) then sort. */
function dedupe<T extends { sourcedId: string }>(arr: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of arr) map.set(item.sourcedId, item);
  return Array.from(map.values()).sort(bySourcedId);
}

function normOrg(o: Org): Org {
  return { ...o, name: o.name?.trim() };
}

function normUser(u: User): User {
  return {
    ...u,
    givenName: u.givenName?.trim(),
    familyName: u.familyName?.trim(),
    email: u.email ? u.email.trim().toLowerCase() : undefined,
    roles: uniqSort(u.roles) as User["roles"],
    grades: uniqSort(u.grades),
    orgSourcedIds: uniqSort(u.orgSourcedIds),
  };
}

function normCourse(c: Course): Course {
  return { ...c, title: c.title?.trim(), grades: uniqSort(c.grades) };
}

function normTerm(t: Term): Term {
  return { ...t, title: t.title?.trim() };
}

function normClass(c: Class): Class {
  return {
    ...c,
    title: c.title?.trim(),
    grades: uniqSort(c.grades),
    termSourcedIds: uniqSort(c.termSourcedIds),
    subjects: uniqSort(c.subjects),
    periods: uniqSort(c.periods),
  };
}

function normEnrollment(e: Enrollment): Enrollment {
  return { ...e };
}

export function normalizeSnapshot(snap: RosterSnapshot): RosterSnapshot {
  return {
    provider: snap.provider,
    orgs: dedupe(snap.orgs.map(normOrg)),
    users: dedupe(snap.users.map(normUser)),
    courses: dedupe(snap.courses.map(normCourse)),
    terms: dedupe(snap.terms.map(normTerm)),
    classes: dedupe(snap.classes.map(normClass)),
    enrollments: dedupe(snap.enrollments.map(normEnrollment)),
    demographics: snap.demographics ? dedupe(snap.demographics) : [],
  };
}

/** Stable per-entity fingerprint used by the diff stage to detect changes. */
export function fingerprint(entity: Record<string, unknown>): string {
  const keys = Object.keys(entity)
    .filter((k) => entity[k] !== undefined)
    .sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = entity[k];
  return JSON.stringify(ordered);
}
