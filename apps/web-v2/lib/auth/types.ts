import { ADMIN_ROLE_HOME, type AdminRole } from "@aivo/admin-auth/types";

export type Role =
  | "parent"
  | "learner"
  | "teacher"
  | "caregiver"
  | "therapist"
  | "school_admin"
  | "district_admin"
  | "platform_admin"
  | "support"
  | "marketing"
  | "sales"
  | "devops"
  | "engineering";

export type SessionProfile = {
  userId: string;
  tenantId: string;
  /**
   * The user's **active** role. Backend authorization keys off this
   * value (ADR 0020 §4). For multi-role users, the additional roles
   * the user is entitled to act as live in {@link roles}.
   */
  role: Role;
  email: string;
  displayName: string;
  permissions: string[];
  /** Sprint A8 — viewer's IANA timezone (user > auto > unset → UTC). */
  timezone?: string | null;
  /** When role==="learner", the LearnerProfile.id this session owns. */
  learnerId?: string;
  /**
   * Phase 1 — Unified identity. Every role the user is entitled to act
   * as. Omitted in legacy real-auth payloads, in which case readers
   * must treat the session as a single-role user (`[role]`). Always
   * includes {@link role}.
   */
  roles?: Role[];
  /**
   * Phase 1 — capability strings granted by the server for the current
   * {@link role}. Mirrors `RoleSession.capabilities` in `@aivo/nav`.
   * Falls back to {@link permissions} when absent for back-compat.
   */
  capabilities?: string[];
};

const ADMIN_APP_URL = "https://admin.aivolearning.com";
const DISTRICT_APP_URL = "https://district.aivolearning.com";

function standaloneAdminHome(role: AdminRole): string {
  const baseUrl = role === "district_admin" ? DISTRICT_APP_URL : ADMIN_APP_URL;
  return new URL(ADMIN_ROLE_HOME[role], baseUrl).toString();
}

export const ROLE_HOME: Record<Role, string> = {
  parent: "/parent/home",
  learner: "/learner/home",
  teacher: "/teacher/home",
  caregiver: "/caregiver/home",
  therapist: "/therapist/home",
  school_admin: standaloneAdminHome("school_admin"),
  district_admin: standaloneAdminHome("district_admin"),
  platform_admin: standaloneAdminHome("platform_admin"),
  support: standaloneAdminHome("support"),
  marketing: standaloneAdminHome("marketing"),
  sales: standaloneAdminHome("sales"),
  devops: standaloneAdminHome("devops"),
  engineering: standaloneAdminHome("engineering"),
};

export const ROLE_LABEL: Record<Role, string> = {
  parent: "Parent",
  learner: "Learner",
  teacher: "Teacher",
  caregiver: "Caregiver",
  therapist: "Therapist",
  school_admin: "School admin",
  district_admin: "District admin",
  platform_admin: "Platform admin",
  support: "Support",
  marketing: "Marketing",
  sales: "Sales",
  devops: "DevOps",
  engineering: "Engineering",
};
