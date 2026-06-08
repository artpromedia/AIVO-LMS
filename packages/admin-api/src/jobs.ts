import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

export type AdminFreshnessStatus = "fresh" | "warning" | "stale" | "never_run";

export interface AdminJob {
  jobName: string;
  service: string;
  description: string;
  periodMs: number;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastReplicaId: string | null;
  lastStatus: string | null;
  lastSent: number | null;
  lastFailed: number | null;
  lastError: string | null;
  freshnessStatus: AdminFreshnessStatus;
  freshnessAgeMs: number | null;
  failed: boolean;
  unregistered: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface AdminJobFreshnessCounts {
  fresh: number;
  warning: number;
  stale: number;
  never_run: number;
  failed: number;
}

export interface AdminJobFreshnessReport {
  jobName: string;
  status: AdminFreshnessStatus;
  ageMs: number | null;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  failed: boolean;
}

export interface AdminJobFreshnessSummary {
  generatedAt: string;
  counts: AdminJobFreshnessCounts;
  reports: AdminJobFreshnessReport[];
}

function normalizeFreshnessStatus(value: unknown): AdminFreshnessStatus {
  const status = String(value ?? "never_run");
  if (status === "fresh" || status === "warning" || status === "stale") return status;
  return "never_run";
}

function asIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function listJobs(session: Pick<SessionProfile, "role">): Promise<AdminJob[]> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/jobs");
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs.map((job) => {
    const row = job as Record<string, unknown>;
    const freshness = (row.freshness ?? {}) as Record<string, unknown>;
    return {
      jobName: String(row.jobName ?? ""),
      service: String(row.service ?? "(unknown)"),
      description: String(row.description ?? ""),
      periodMs: Number(row.periodMs ?? 0),
      lastRunAt: asIsoOrNull(row.lastRunAt),
      lastFinishedAt: asIsoOrNull(row.lastFinishedAt),
      lastReplicaId: row.lastReplicaId ? String(row.lastReplicaId) : null,
      lastStatus: row.lastStatus ? String(row.lastStatus) : null,
      lastSent: asNumberOrNull(row.lastSent),
      lastFailed: asNumberOrNull(row.lastFailed),
      lastError: row.lastError ? String(row.lastError) : null,
      freshnessStatus: normalizeFreshnessStatus(freshness.status),
      freshnessAgeMs: asNumberOrNull(freshness.ageMs),
      failed: Boolean(freshness.failed),
      unregistered: Boolean(row.unregistered),
      firstSeenAt: asIsoOrNull(row.firstSeenAt),
      lastSeenAt: asIsoOrNull(row.lastSeenAt),
    };
  });
}

export async function getJobsFreshnessSummary(
  session: Pick<SessionProfile, "role">,
): Promise<AdminJobFreshnessSummary> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/jobs/freshness",
  );
  const rawCounts = (payload.counts ?? {}) as Record<string, unknown>;
  const reports = Array.isArray(payload.reports) ? payload.reports : [];
  return {
    generatedAt: String(payload.generatedAt ?? new Date(0).toISOString()),
    counts: {
      fresh: Number(rawCounts.fresh ?? 0),
      warning: Number(rawCounts.warning ?? 0),
      stale: Number(rawCounts.stale ?? 0),
      never_run: Number(rawCounts.never_run ?? 0),
      failed: Number(rawCounts.failed ?? 0),
    },
    reports: reports.map((report) => {
      const row = report as Record<string, unknown>;
      return {
        jobName: String(row.jobName ?? ""),
        status: normalizeFreshnessStatus(row.status),
        ageMs: asNumberOrNull(row.ageMs),
        lastRunAt: asIsoOrNull(row.lastRunAt),
        lastFinishedAt: asIsoOrNull(row.lastFinishedAt),
        failed: Boolean(row.failed),
      };
    }),
  };
}
