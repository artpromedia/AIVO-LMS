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
  role: Role;
  email: string;
  displayName: string;
  permissions: string[];
  /** When role==="learner", the LearnerProfile.id this session owns. */
  learnerId?: string;
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
