import "server-only";

import { adminGet, adminGetAllPages } from "./client";
import {
  type AdminLearnerSummary,
  type AdminTenantDetail,
  type AdminTenantSummary,
  type PlatformAiCostsSnapshot,
  type PlatformAiCostEvent,
  type PlatformAiCostTenant,
  type AdminUserDetail,
  type AdminUserSummary,
  type PlatformSystemHealth,
  type RecentAiActivityEntry,
  adminRoleLabel,
  adminRoleTone,
  adminTenantTypeLabel,
  normalizeRoleKey,
  normalizeTenantKind,
} from "./types";
import type { SessionProfile } from "@aivo/admin-auth/types";

function mapTenant(row: Record<string, unknown>): AdminTenantSummary {
  const type = typeof row.type === "string" ? row.type : null;
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    type,
    tenantKind: normalizeTenantKind(type),
    typeLabel: adminTenantTypeLabel(type),
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
    status: row.status ? String(row.status) : null,
  };
}

function mapLearner(row: Record<string, unknown>): AdminLearnerSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    tenantId: row.tenantId ? String(row.tenantId) : null,
    gradeLevel: typeof row.gradeLevel === "number" ? row.gradeLevel : null,
    functioningLevel: row.functioningLevel ? String(row.functioningLevel) : null,
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
  };
}

function mapUser(row: Record<string, unknown>): AdminUserSummary {
  const role = String(row.role ?? "UNKNOWN");
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    email: row.email ? String(row.email) : null,
    role,
    roleKey: normalizeRoleKey(role),
    roleLabel: adminRoleLabel(role),
    roleTone: adminRoleTone(role),
    tenantId: row.tenantId ? String(row.tenantId) : null,
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    lastLoginAt: row.lastLoginAt ? String(row.lastLoginAt) : null,
    deactivatedAt: row.deactivatedAt ? String(row.deactivatedAt) : null,
  };
}

export async function listAdminUsers(
  session: Pick<SessionProfile, "role">,
): Promise<AdminUserSummary[]> {
  const rows = await adminGetAllPages<Record<string, unknown>>(session, "/api/admin-svc/users", "users");
  return rows.map(mapUser);
}

export async function getAdminUser(
  session: Pick<SessionProfile, "role">,
  userId: string,
): Promise<AdminUserDetail> {
  const row = await adminGet<Record<string, unknown>>(
    session,
    `/api/admin-svc/users/${encodeURIComponent(userId)}`,
  );
  return {
    ...mapUser(row),
    emailVerified: Boolean(row.emailVerified),
    avatarUrl: row.avatarUrl ? String(row.avatarUrl) : null,
    hasGoogle: Boolean(row.hasGoogle),
    hasApple: Boolean(row.hasApple),
    lastLoginIp: row.lastLoginIp ? String(row.lastLoginIp) : null,
    updatedAt: row.updatedAt ? String(row.updatedAt) : null,
    activeSessions:
      typeof row.activeSessions === "number" ? row.activeSessions : Number(row.activeSessions ?? 0),
    tenant:
      row.tenant && typeof row.tenant === "object" ? mapTenant(row.tenant as Record<string, unknown>) : null,
    learners: Array.isArray(row.learners)
      ? row.learners.map((learner) => mapLearner(learner as Record<string, unknown>))
      : [],
  };
}

export async function listAdminTenants(
  session: Pick<SessionProfile, "role">,
): Promise<AdminTenantSummary[]> {
  const rows = await adminGetAllPages<Record<string, unknown>>(
    session,
    "/api/admin-svc/tenants",
    "tenants",
  );
  return rows.map(mapTenant);
}

export async function getAdminTenant(
  session: Pick<SessionProfile, "role">,
  tenantId: string,
): Promise<AdminTenantDetail> {
  const row = await adminGet<Record<string, unknown>>(
    session,
    `/api/admin-svc/tenants/${encodeURIComponent(tenantId)}`,
  );
  return {
    ...mapTenant(row),
    userCount: typeof row.userCount === "number" ? row.userCount : Number(row.userCount ?? 0),
    learnerCount:
      typeof row.learnerCount === "number" ? row.learnerCount : Number(row.learnerCount ?? 0),
    users: Array.isArray(row.users)
      ? row.users.map((user) => mapUser(user as Record<string, unknown>))
      : [],
    learners: Array.isArray(row.learners)
      ? row.learners.map((learner) => mapLearner(learner as Record<string, unknown>))
      : [],
  };
}

export async function listAdminLearners(
  session: Pick<SessionProfile, "role">,
): Promise<AdminLearnerSummary[]> {
  const rows = await adminGetAllPages<Record<string, unknown>>(
    session,
    "/api/admin-svc/learners",
    "learners",
  );
  return rows.map(mapLearner);
}

export async function getPlatformSystemHealth(
  session: Pick<SessionProfile, "role">,
): Promise<PlatformSystemHealth> {
  const row = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/platform/system-health");
  const rawTenantCounts =
    row.tenantCounts && typeof row.tenantCounts === "object"
      ? (row.tenantCounts as Record<string, unknown>)
      : {};
  return {
    tenantCounts: {
      district: Number(rawTenantCounts.district ?? 0),
      school: Number(rawTenantCounts.school ?? 0),
      family: Number(rawTenantCounts.family ?? 0),
      unknown: Number(rawTenantCounts.unknown ?? 0),
    },
    tenantsTotal: Number(row.tenantsTotal ?? 0),
    usersTotal: Number(row.usersTotal ?? 0),
    learnersTotal: Number(row.learnersTotal ?? 0),
    lessonRunsTotal: Number(row.lessonRunsTotal ?? 0),
    lessonRunsCompleted: Number(row.lessonRunsCompleted ?? 0),
    aiRequests24h: Number(row.aiRequests24h ?? 0),
    aiModelsActive24h: Number(row.aiModelsActive24h ?? 0),
    aiAvgLatencyMs24h: Number(row.aiAvgLatencyMs24h ?? 0),
    aiEstimatedCostUsd24h: Number(row.aiEstimatedCostUsd24h ?? 0),
  };
}

export async function listRecentAiActivity(
  session: Pick<SessionProfile, "role">,
  limit = 8,
): Promise<RecentAiActivityEntry[]> {
  const row = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/platform/ai-activity", {
    limit,
  });
  const entries = Array.isArray(row.entries) ? row.entries : [];
  return entries.map((entry) => ({
    id: String((entry as Record<string, unknown>).id),
    provider: String((entry as Record<string, unknown>).provider ?? "unknown"),
    model: String((entry as Record<string, unknown>).model ?? "unknown"),
    inputTokens: Number((entry as Record<string, unknown>).inputTokens ?? 0),
    outputTokens: Number((entry as Record<string, unknown>).outputTokens ?? 0),
    latencyMs: Number((entry as Record<string, unknown>).latencyMs ?? 0),
    estimatedCostUsd: Number((entry as Record<string, unknown>).estimatedCostUsd ?? 0),
    learnerId: (entry as Record<string, unknown>).learnerId
      ? String((entry as Record<string, unknown>).learnerId)
      : null,
    tenantId: (entry as Record<string, unknown>).tenantId
      ? String((entry as Record<string, unknown>).tenantId)
      : null,
    tenantName: (entry as Record<string, unknown>).tenantName
      ? String((entry as Record<string, unknown>).tenantName)
      : null,
    createdAt: String((entry as Record<string, unknown>).createdAt ?? new Date(0).toISOString()),
  }));
}

function mapAiCostEvent(entry: Record<string, unknown>): PlatformAiCostEvent {
  return {
    id: String(entry.id),
    provider: String(entry.provider ?? "unknown"),
    model: String(entry.model ?? "unknown"),
    inputTokens: Number(entry.inputTokens ?? 0),
    outputTokens: Number(entry.outputTokens ?? 0),
    latencyMs: Number(entry.latencyMs ?? 0),
    estimatedCostUsd: Number(entry.estimatedCostUsd ?? 0),
    learnerId: entry.learnerId ? String(entry.learnerId) : null,
    tenantId: entry.tenantId ? String(entry.tenantId) : null,
    tenantName: entry.tenantName ? String(entry.tenantName) : null,
    createdAt: String(entry.createdAt ?? new Date(0).toISOString()),
  };
}

function mapAiCostTenant(row: Record<string, unknown>): PlatformAiCostTenant {
  const budget =
    row.budget && typeof row.budget === "object"
      ? (row.budget as Record<string, unknown>)
      : {};
  const tenantType = row.tenantType ? String(row.tenantType) : null;
  return {
    tenantId: String(row.tenantId),
    tenantName: row.tenantName ? String(row.tenantName) : null,
    tenantType,
    tenantKind: normalizeTenantKind(tenantType),
    tenantTypeLabel: adminTenantTypeLabel(tenantType),
    requestCount24h: Number(row.requestCount24h ?? 0),
    estimatedCostUsd24h: Number(row.estimatedCostUsd24h ?? 0),
    inputTokens24h: Number(row.inputTokens24h ?? 0),
    outputTokens24h: Number(row.outputTokens24h ?? 0),
    avgLatencyMs24h: Number(row.avgLatencyMs24h ?? 0),
    budget: {
      budgetAvailable: Boolean(budget.budgetAvailable),
      tenantId: String(budget.tenantId ?? row.tenantId),
      day: budget.day ? String(budget.day) : null,
      spendCents:
        budget.spendCents === null || budget.spendCents === undefined
          ? null
          : Number(budget.spendCents),
      spendUsd:
        budget.spendUsd === null || budget.spendUsd === undefined ? null : Number(budget.spendUsd),
      warnCents:
        budget.warnCents === null || budget.warnCents === undefined
          ? null
          : Number(budget.warnCents),
      warnUsd:
        budget.warnUsd === null || budget.warnUsd === undefined ? null : Number(budget.warnUsd),
      capCents:
        budget.capCents === null || budget.capCents === undefined ? null : Number(budget.capCents),
      capUsd: budget.capUsd === null || budget.capUsd === undefined ? null : Number(budget.capUsd),
      completionCount:
        budget.completionCount === null || budget.completionCount === undefined
          ? null
          : Number(budget.completionCount),
      blockedCount:
        budget.blockedCount === null || budget.blockedCount === undefined
          ? null
          : Number(budget.blockedCount),
      warned: Boolean(budget.warned),
      exceeded: Boolean(budget.exceeded),
      error: budget.error ? String(budget.error) : null,
    },
  };
}

export async function getPlatformAiCosts(
  session: Pick<SessionProfile, "role">,
  limit = 50,
): Promise<PlatformAiCostsSnapshot> {
  const row = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/platform/ai-costs", {
    limit,
  });
  const summary =
    row.summary && typeof row.summary === "object"
      ? (row.summary as Record<string, unknown>)
      : {};
  const tenants = Array.isArray(row.tenants) ? row.tenants : [];
  const events = Array.isArray(row.events) ? row.events : [];

  return {
    summary: {
      totalEstimatedCostUsd24h: Number(summary.totalEstimatedCostUsd24h ?? 0),
      requestCount24h: Number(summary.requestCount24h ?? 0),
      activeTenants24h: Number(summary.activeTenants24h ?? 0),
      warningTenants: Number(summary.warningTenants ?? 0),
      overCapTenants: Number(summary.overCapTenants ?? 0),
      trackedTenants: Number(summary.trackedTenants ?? 0),
      budgetsAvailable: Number(summary.budgetsAvailable ?? 0),
    },
    tenants: tenants.map((tenant) => mapAiCostTenant(tenant as Record<string, unknown>)),
    events: events.map((event) => mapAiCostEvent(event as Record<string, unknown>)),
  };
}
