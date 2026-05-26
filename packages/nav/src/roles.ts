/**
 * The eight AIVO roles. Mobile exposes the five learner-facing roles
 * (learner / parent / teacher / therapist / caregiver) plus school-admin;
 * "districtAdmin" and "internal" are web-only.
 *
 * Sprint 9 / 10 added `therapist` and `caregiver` to the canonical
 * registry. Their shells already exist in apps/web-v2/app/{therapist,
 * caregiver}/* and apps/mobile/app/(therapist|caregiver)/*, and the
 * brand package has carried their themes since Sprint 03 — this enum
 * is the last gate that needed to open before route-level RBAC can
 * recognise them.
 */
export type Role =
  | "learner"
  | "parent"
  | "teacher"
  | "therapist"
  | "caregiver"
  | "schoolAdmin"
  | "districtAdmin"
  | "internal";

export const ROLES: readonly Role[] = [
  "learner",
  "parent",
  "teacher",
  "therapist",
  "caregiver",
  "schoolAdmin",
  "districtAdmin",
  "internal",
] as const;

export interface RoleMeta {
  id: Role;
  /** Short label for chips and switcher rows. */
  label: string;
  /** Human-friendly description shown in the role-switcher sheet. */
  description: string;
  /** Whether the mobile app exposes this role at all. */
  onMobile: boolean;
  /** Whether the web shell exposes this role at all. */
  onWeb: boolean;
  /** True for roles that should require step-up auth before switching to. */
  requiresStepUp: boolean;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  learner: {
    id: "learner",
    label: "Learner",
    description: "Your lessons, missions, and AI tutor.",
    onMobile: true,
    onWeb: true,
    requiresStepUp: false,
  },
  parent: {
    id: "parent",
    label: "Parent",
    description: "Supervise your children, approve content, and track progress.",
    onMobile: true,
    onWeb: true,
    requiresStepUp: true,
  },
  teacher: {
    id: "teacher",
    label: "Teacher",
    description: "Plan lessons, see class insights, message families.",
    onMobile: true,
    onWeb: true,
    requiresStepUp: true,
  },
  therapist: {
    id: "therapist",
    label: "Therapist",
    description: "Caseload, session notes, IEP goals, and progress reports.",
    onMobile: true,
    onWeb: true,
    requiresStepUp: true,
  },
  caregiver: {
    id: "caregiver",
    label: "Caregiver",
    description: "Day-to-day observations and progress on the children you support.",
    onMobile: true,
    onWeb: true,
    requiresStepUp: true,
  },
  schoolAdmin: {
    id: "schoolAdmin",
    label: "School admin",
    description: "Manage your school's roster, staff, billing, and reports.",
    onMobile: true,
    onWeb: true,
    requiresStepUp: true,
  },
  districtAdmin: {
    id: "districtAdmin",
    label: "District admin",
    description: "Oversee all schools, compliance, and district reporting.",
    onMobile: false,
    onWeb: true,
    requiresStepUp: true,
  },
  internal: {
    id: "internal",
    label: "Internal",
    description: "AIVO operator tools, platform health, and audit logs.",
    onMobile: false,
    onWeb: true,
    requiresStepUp: true,
  },
};
