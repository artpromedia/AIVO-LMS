import "server-only";

import { adminGet, adminPost, AdminApiError } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * School rostering / learner-import read+write module.
 *
 * Backed by the admin-svc learner-import routes
 * (services/admin-svc/src/routes/learner-import.ts), which are school-scoped
 * via :schoolId. The school in scope is the caller's tenant, so every function
 * takes the schoolId explicitly (typically `session`'s tenantId).
 *
 * Endpoints:
 *   POST /admin/schools/:schoolId/learners/import/validate   { csvText }
 *   POST /admin/schools/:schoolId/learners/import/run        { csvText, dryRun? }
 *   GET  /admin/schools/:schoolId/learners/import/template   (CSV download)
 *   GET  /admin/schools/:schoolId/learners/import/:jobId     (job status)
 */

export type AdminImportJobStatus = "pending" | "running" | "done" | "failed";

/** Progress / resume cursor for an import job. */
export interface AdminImportProgress {
  cursor: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  done: boolean;
}

/** Aggregate counts surfaced alongside an import job. */
export interface AdminImportJobSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  done: boolean;
}

/** A single learner-import job as returned by admin-svc. */
export interface AdminImportJob {
  jobId: string;
  status: AdminImportJobStatus;
  progress: AdminImportProgress;
  summary: AdminImportJobSummary;
  errors: string[] | null;
}

/** Per-column validation issue from a CSV preview. */
export interface AdminImportIssue {
  row: number;
  column: string | null;
  message: string;
  severity: "error" | "warning";
}

/** Result of validating a CSV without committing. */
export interface AdminImportPreview {
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
  };
  mapping: Record<string, number>;
  missingColumns: string[];
  issues: AdminImportIssue[];
  errorReportCsv: string;
}

/** Result of committing a CSV import (kicks off a background run). */
export interface AdminImportCommitResult {
  jobId: string;
  status: AdminImportJobStatus;
  progress: AdminImportProgress;
}

function importBasePath(schoolId: string): string {
  return `/admin/schools/${encodeURIComponent(schoolId)}/learners/import`;
}

function normalizeStatus(value: unknown): AdminImportJobStatus {
  const status = String(value ?? "pending");
  if (status === "running" || status === "done" || status === "failed") return status;
  return "pending";
}

function mapProgress(value: unknown): AdminImportProgress {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    cursor: Number(row.cursor ?? 0),
    total: Number(row.total ?? 0),
    created: Number(row.created ?? 0),
    updated: Number(row.updated ?? 0),
    skipped: Number(row.skipped ?? 0),
    done: Boolean(row.done),
  };
}

function mapImportJob(row: Record<string, unknown>): AdminImportJob {
  const progress = mapProgress(row.progress);
  const summaryRow =
    row.summary && typeof row.summary === "object"
      ? (row.summary as Record<string, unknown>)
      : {};
  return {
    jobId: String(row.jobId),
    status: normalizeStatus(row.status),
    progress,
    summary: {
      total: Number(summaryRow.total ?? progress.total),
      created: Number(summaryRow.created ?? progress.created),
      updated: Number(summaryRow.updated ?? progress.updated),
      skipped: Number(summaryRow.skipped ?? progress.skipped),
      done: Boolean(summaryRow.done ?? progress.done),
    },
    errors: Array.isArray(row.errors) ? row.errors.map((e) => String(e)) : null,
  };
}

/**
 * Fetch a single import job by id. Returns `null` when the job is unknown
 * (admin-svc replies `{ error: "job_not_found" }` with a 404).
 */
export async function getImportJob(
  session: Pick<SessionProfile, "role">,
  schoolId: string,
  jobId: string,
): Promise<AdminImportJob | null> {
  try {
    const row = await adminGet<Record<string, unknown>>(
      session,
      `${importBasePath(schoolId)}/${encodeURIComponent(jobId)}`,
    );
    return mapImportJob(row);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * List recent import jobs for a school.
 *
 * admin-svc exposes per-job status today; this resolves the supplied job ids
 * (e.g. ids retained in the page's URL/history) to job objects, skipping any
 * that no longer exist. Pass no ids to get an empty list.
 */
export async function listImportJobs(
  session: Pick<SessionProfile, "role">,
  schoolId: string,
  jobIds: readonly string[] = [],
): Promise<AdminImportJob[]> {
  const jobs = await Promise.all(jobIds.map((jobId) => getImportJob(session, schoolId, jobId)));
  return jobs.filter((job): job is AdminImportJob => job !== null);
}

/** Validate a pasted CSV without persisting anything (preview + counts). */
export async function validateLearnerImport(
  session: Pick<SessionProfile, "role">,
  schoolId: string,
  csvText: string,
): Promise<AdminImportPreview> {
  const row = await adminPost<Record<string, unknown>>(
    session,
    `${importBasePath(schoolId)}/validate`,
    { csvText },
  );
  const summaryRow =
    row.summary && typeof row.summary === "object"
      ? (row.summary as Record<string, unknown>)
      : {};
  return {
    summary: {
      totalRows: Number(summaryRow.totalRows ?? 0),
      validRows: Number(summaryRow.validRows ?? 0),
      errorRows: Number(summaryRow.errorRows ?? 0),
      warningRows: Number(summaryRow.warningRows ?? 0),
    },
    mapping:
      row.mapping && typeof row.mapping === "object"
        ? (row.mapping as Record<string, number>)
        : {},
    missingColumns: Array.isArray(row.missingColumns)
      ? row.missingColumns.map((c) => String(c))
      : [],
    issues: Array.isArray(row.issues)
      ? row.issues.map((issue) => {
          const i = issue as Record<string, unknown>;
          return {
            row: Number(i.row ?? 0),
            column: i.column ? String(i.column) : null,
            message: String(i.message ?? ""),
            severity: i.severity === "warning" ? "warning" : "error",
          };
        })
      : [],
    errorReportCsv: String(row.errorReportCsv ?? ""),
  };
}

/** Commit a pasted CSV — kicks off the background import run and returns the job. */
export async function commitLearnerImport(
  session: Pick<SessionProfile, "role">,
  schoolId: string,
  csvText: string,
): Promise<AdminImportCommitResult> {
  const row = await adminPost<Record<string, unknown>>(
    session,
    `${importBasePath(schoolId)}/run`,
    { csvText },
  );
  return {
    jobId: String(row.jobId),
    status: normalizeStatus(row.status),
    progress: mapProgress(row.progress),
  };
}

/** Path to the CSV template download for a school (served as text/csv). */
export function importTemplatePath(schoolId: string): string {
  return `${importBasePath(schoolId)}/template`;
}
