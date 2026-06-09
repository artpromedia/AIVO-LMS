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
  /**
   * Empty string for tenantless platform-scope staff (platform_admin,
   * support, devops, …) whose users row has tenant_id = NULL. Tenant-scoped
   * roles (school_admin, district_admin) always carry a real tenant id.
   */
  tenantId: string;
  role: Role;
  email: string;
  displayName: string;
  permissions: string[];
  learnerId?: string;
  roles?: Role[];
  capabilities?: string[];
};

export const CONSUMER_APP_URL = process.env.NEXT_PUBLIC_CONSUMER_APP_URL || "https://app.aivolearning.com";

export const ADMIN_ROLE_HOME = {
  school_admin: "/school",
  district_admin: "/district",
  platform_admin: "/platform",
  support: "/platform",
  marketing: "/platform",
  sales: "/platform",
  devops: "/platform",
  engineering: "/platform",
} as const satisfies Partial<Record<Role, string>>;

export type AdminRole = keyof typeof ADMIN_ROLE_HOME;

export const ROLE_HOME: Record<Role, string> = {
  parent: `${CONSUMER_APP_URL}/parent/home`,
  learner: `${CONSUMER_APP_URL}/learner/home`,
  teacher: `${CONSUMER_APP_URL}/teacher/home`,
  caregiver: `${CONSUMER_APP_URL}/caregiver/home`,
  therapist: `${CONSUMER_APP_URL}/therapist/home`,
  ...ADMIN_ROLE_HOME,
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
