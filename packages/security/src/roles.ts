export enum Role {
  PARENT = "PARENT",
  LEARNER = "LEARNER",
  TEACHER = "TEACHER",
  CAREGIVER = "CAREGIVER",
  THERAPIST = "THERAPIST",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  DISTRICT_ADMIN = "DISTRICT_ADMIN",
  SCHOOL_ADMIN = "SCHOOL_ADMIN",
  SPED_LEAD = "SPED_LEAD",
  SALES = "SALES",
  MARKETING = "MARKETING",
  CUSTOMER_CARE = "CUSTOMER_CARE",
  SUPPORT = "SUPPORT",
  FINANCE = "FINANCE",
  DEVOPS = "DEVOPS",
  ENGINEERING = "ENGINEERING",
}

export const allRoles = Object.values(Role) as Role[];

export function isRole(value: string | null | undefined): value is Role {
  return typeof value === "string" && allRoles.includes(value as Role);
}
