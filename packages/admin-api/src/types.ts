export type AdminBadgeTone = "primary" | "success" | "neutral" | "warning" | "danger";

export type AdminRoleKey =
  | "platform_admin"
  | "district_admin"
  | "school_admin"
  | "teacher"
  | "parent"
  | "learner"
  | "caregiver"
  | "therapist"
  | "support"
  | "customer_care"
  | "sales"
  | "marketing"
  | "finance"
  | "devops"
  | "engineering"
  | "sped_lead"
  | "unknown";

export type AdminTenantKind = "district" | "school" | "family" | "unknown";

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeRoleKey(value: string | null | undefined): AdminRoleKey {
  switch ((value ?? "").toUpperCase()) {
    case "PLATFORM_ADMIN":
      return "platform_admin";
    case "DISTRICT_ADMIN":
      return "district_admin";
    case "SCHOOL_ADMIN":
      return "school_admin";
    case "SPED_LEAD":
      return "sped_lead";
    case "TEACHER":
      return "teacher";
    case "PARENT":
      return "parent";
    case "LEARNER":
      return "learner";
    case "CAREGIVER":
      return "caregiver";
    case "THERAPIST":
      return "therapist";
    case "SUPPORT":
      return "support";
    case "CUSTOMER_CARE":
      return "customer_care";
    case "SALES":
      return "sales";
    case "MARKETING":
      return "marketing";
    case "FINANCE":
      return "finance";
    case "DEVOPS":
      return "devops";
    case "ENGINEERING":
      return "engineering";
    default:
      return "unknown";
  }
}

export function adminRoleLabel(value: string | null | undefined): string {
  const key = normalizeRoleKey(value);
  if (key === "unknown") {
    return value ? titleCase(value) : "Unknown";
  }
  return titleCase(key);
}

export function adminRoleTone(value: string | null | undefined): AdminBadgeTone {
  switch (normalizeRoleKey(value)) {
    case "platform_admin":
    case "support":
    case "customer_care":
    case "marketing":
    case "sales":
    case "finance":
    case "devops":
    case "engineering":
      return "warning";
    case "district_admin":
      return "primary";
    case "school_admin":
    case "teacher":
    case "sped_lead":
      return "success";
    case "learner":
      return "primary";
    case "parent":
    case "caregiver":
    case "therapist":
    default:
      return "neutral";
  }
}

export function normalizeTenantKind(value: string | null | undefined): AdminTenantKind {
  switch ((value ?? "").toUpperCase()) {
    case "B2B_DISTRICT":
      return "district";
    case "B2B_SCHOOL":
      return "school";
    case "B2C_FAMILY":
      return "family";
    default:
      return "unknown";
  }
}

export function adminTenantTypeLabel(value: string | null | undefined): string {
  const kind = normalizeTenantKind(value);
  return kind === "unknown" ? (value ? titleCase(value) : "Unknown") : titleCase(kind);
}

export function adminTenantTone(value: string | null | undefined): AdminBadgeTone {
  switch (normalizeTenantKind(value)) {
    case "district":
      return "primary";
    case "school":
      return "success";
    case "family":
      return "neutral";
    default:
      return "warning";
  }
}

export function normalizeBillingStatus(value: string | null | undefined): string {
  switch ((value ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "past due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    case "cancelled":
    case "canceled":
      return "canceled";
    default:
      return value?.toLowerCase() ?? "unknown";
  }
}

export function billingTone(value: string | null | undefined): AdminBadgeTone {
  switch (normalizeBillingStatus(value)) {
    case "active":
      return "success";
    case "trialing":
      return "warning";
    case "past_due":
      return "danger";
    default:
      return "neutral";
  }
}

export interface AdminTenantSummary {
  id: string;
  name: string;
  type: string | null;
  tenantKind: AdminTenantKind;
  typeLabel: string;
  createdAt: string;
  updatedAt?: string | null;
  status?: string | null;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string | null;
  role: string;
  roleKey: AdminRoleKey;
  roleLabel: string;
  roleTone: AdminBadgeTone;
  tenantId: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  deactivatedAt?: string | null;
}

export interface AdminLearnerSummary {
  id: string;
  name: string;
  tenantId: string | null;
  gradeLevel: number | null;
  functioningLevel?: string | null;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  emailVerified: boolean;
  avatarUrl?: string | null;
  hasGoogle?: boolean;
  hasApple?: boolean;
  lastLoginIp?: string | null;
  updatedAt?: string | null;
  activeSessions?: number;
  tenant: AdminTenantSummary | null;
  learners: AdminLearnerSummary[];
}

export interface AdminTenantDetail extends AdminTenantSummary {
  userCount: number;
  learnerCount: number;
  users: AdminUserSummary[];
  learners: AdminLearnerSummary[];
}

export interface AdminBillingAccount {
  id: string;
  tenantId: string;
  tenantName: string | null;
  tenantType: string | null;
  tenantKind: AdminTenantKind;
  tenantTypeLabel: string;
  plan: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  currentPeriodEnd?: string | null;
  paymentStatus?: string | null;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  actorRoleLabel: string;
  resourceType: string;
  resourceId?: string | null;
  tenantId?: string | null;
  createdAt: string;
}

export interface PlatformSystemHealth {
  tenantCounts: Record<AdminTenantKind | "unknown", number>;
  tenantsTotal: number;
  usersTotal: number;
  learnersTotal: number;
  lessonRunsTotal: number;
  lessonRunsCompleted: number;
  aiRequests24h: number;
  aiModelsActive24h: number;
  aiAvgLatencyMs24h: number;
  aiEstimatedCostUsd24h: number;
}

export interface RecentAiActivityEntry {
  id: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  learnerId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  createdAt: string;
}

export interface PlatformAiBudgetSnapshot {
  budgetAvailable: boolean;
  tenantId: string;
  day: string | null;
  spendCents: number | null;
  spendUsd: number | null;
  warnCents: number | null;
  warnUsd: number | null;
  capCents: number | null;
  capUsd: number | null;
  completionCount: number | null;
  blockedCount: number | null;
  warned: boolean;
  exceeded: boolean;
  error: string | null;
}

export interface PlatformAiCostTenant {
  tenantId: string;
  tenantName: string | null;
  tenantType: string | null;
  tenantKind: AdminTenantKind;
  tenantTypeLabel: string;
  requestCount24h: number;
  estimatedCostUsd24h: number;
  inputTokens24h: number;
  outputTokens24h: number;
  avgLatencyMs24h: number;
  budget: PlatformAiBudgetSnapshot;
}

export interface PlatformAiCostEvent extends RecentAiActivityEntry {}

export interface PlatformAiCostSummary {
  totalEstimatedCostUsd24h: number;
  requestCount24h: number;
  activeTenants24h: number;
  warningTenants: number;
  overCapTenants: number;
  trackedTenants: number;
  budgetsAvailable: number;
}

export interface PlatformAiCostsSnapshot {
  summary: PlatformAiCostSummary;
  tenants: PlatformAiCostTenant[];
  events: PlatformAiCostEvent[];
}
