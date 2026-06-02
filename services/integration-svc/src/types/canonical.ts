/**
 * Sprint 2 (SIS Roster Sync) — canonical roster schema.
 *
 * Every connector (OneRoster REST/CSV, Clever, ClassLink) extracts into
 * these provider-neutral shapes, so the rest of the pipeline (diff, apply,
 * reconcile) and all downstream events speak a single vocabulary. This is
 * the OneRoster 1.2 data model, trimmed to what AIVO consumes.
 *
 * Identity is always the pair `(provider, sourcedId)`; the mapping table
 * (`sync_mappings`) resolves that to an internal id. Records are never
 * hard-deleted — `status: "tobedeleted"` drives a soft-delete (state
 * inactive + effective date) downstream.
 */

export type Provider = "oneroster" | "clever" | "classlink";

/** OneRoster status verb. `tobedeleted` => soft-delete downstream. */
export type EntityStatus = "active" | "tobedeleted";

export type OrgType = "district" | "school" | "department" | "national" | "state" | "local";

export type RoleType =
  | "administrator"
  | "teacher"
  | "student"
  | "parent"
  | "guardian"
  | "aide"
  | "proctor"
  | "relative";

export type ClassType = "homeroom" | "scheduled";

export type SessionType = "gradingPeriod" | "semester" | "schoolYear" | "term";

/** Fields common to every canonical entity. */
export interface CanonicalBase {
  provider: Provider;
  /** Provider-native stable id (OneRoster `sourcedId`, Clever/ClassLink id). */
  sourcedId: string;
  status: EntityStatus;
  /** Provider's last-modified timestamp (ISO 8601), when supplied. */
  dateLastModified?: string;
}

export interface Org extends CanonicalBase {
  name: string;
  type: OrgType;
  /** Human-facing identifier (NCES id, state id, etc.). */
  identifier?: string;
  /** sourcedId of the parent org (school -> district). */
  parentSourcedId?: string;
}

/** Privacy-sensitive student demographics — handled separately and never logged. */
export interface Demographics {
  provider: Provider;
  sourcedId: string;
  birthDate?: string;
  sex?: string;
  americanIndianOrAlaskaNative?: boolean;
  asian?: boolean;
  blackOrAfricanAmerican?: boolean;
  nativeHawaiianOrOtherPacificIslander?: boolean;
  white?: boolean;
  hispanicOrLatinoEthnicity?: boolean;
  countryOfBirthCode?: string;
}

export interface User extends CanonicalBase {
  /** OneRoster `enabledUser`. */
  enabled: boolean;
  givenName: string;
  familyName: string;
  middleName?: string;
  email?: string;
  username?: string;
  roles: RoleType[];
  /** Primary role used for AIVO account provisioning. */
  primaryRole: RoleType;
  grades?: string[];
  /** sourcedIds of orgs this user belongs to. */
  orgSourcedIds: string[];
  /** Opaque per-provider identifiers (state id, SIS id). */
  identifiers?: Record<string, string>;
}

export interface Course extends CanonicalBase {
  title: string;
  courseCode?: string;
  grades?: string[];
  orgSourcedId?: string;
  schoolYearSourcedId?: string;
}

export interface Term extends CanonicalBase {
  title: string;
  type: SessionType;
  startDate?: string;
  endDate?: string;
  /** sourcedId of the parent academic session (term -> schoolYear). */
  parentSourcedId?: string;
  schoolYear?: string;
}

export interface Class extends CanonicalBase {
  title: string;
  classCode?: string;
  type: ClassType;
  grades?: string[];
  courseSourcedId?: string;
  schoolSourcedId: string;
  termSourcedIds: string[];
  subjects?: string[];
  periods?: string[];
}

export interface Enrollment extends CanonicalBase {
  classSourcedId: string;
  schoolSourcedId: string;
  userSourcedId: string;
  role: RoleType;
  primary?: boolean;
  beginDate?: string;
  endDate?: string;
}

/** A full canonical roster snapshot for one tenant from one provider. */
export interface RosterSnapshot {
  provider: Provider;
  orgs: Org[];
  users: User[];
  courses: Course[];
  terms: Term[];
  classes: Class[];
  enrollments: Enrollment[];
  demographics?: Demographics[];
}

/** Entity kinds, in dependency (load) order. */
export const ENTITY_KINDS = [
  "orgs",
  "terms",
  "courses",
  "classes",
  "users",
  "enrollments",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export function emptySnapshot(provider: Provider): RosterSnapshot {
  return {
    provider,
    orgs: [],
    users: [],
    courses: [],
    terms: [],
    classes: [],
    enrollments: [],
    demographics: [],
  };
}
