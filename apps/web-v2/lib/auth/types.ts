export type Role =
  | "parent"
  | "learner"
  | "teacher"
  | "caregiver"
  | "therapist"
  | "school_admin"
  | "district_admin"
  | "platform_admin";

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

export const ROLE_HOME: Record<Role, string> = {
  parent: "/parent/home",
  learner: "/learner/home",
  teacher: "/teacher/home",
  caregiver: "/caregiver/home",
  therapist: "/therapist/home",
  school_admin: "/admin/school",
  district_admin: "/admin/district",
  platform_admin: "/admin/platform",
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
};
