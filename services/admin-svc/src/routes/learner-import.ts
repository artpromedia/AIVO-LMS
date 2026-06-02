/**
 * Sprint 6 — Learner bulk-import routes (admin-svc).
 *
 * Backed by @aivo/learner-import for CSV parsing, validation, and the
 * resumable chunked engine. The in-memory job/learner stores mirror the
 * deletion-requests.ts Map precedent.
 *
 * // TODO(sprint6): Persist import jobs + learner rows in Postgres,
 * //   following the existing dpa-store pattern in data-governance-svc.
 *
 * RBAC: allowed for PLATFORM_ADMIN, DISTRICT_ADMIN, SCHOOL_ADMIN.
 * Note: finer school-ownership scoping is enforced at the BFF/identity layer.
 */
import type { FastifyInstance } from "fastify";
import {
  validateCsv,
  toErrorReportCsv,
  templateCsv,
  runImport,
  dryRunDiff,
  initialProgress,
  type NormalizedLearner,
  type ImportProgress,
} from "@aivo/learner-import";
import { logAuditEvent } from "./audit.js";
import {
  postAdminSchoolsLearnerImportValidateSchema,
  postAdminSchoolsLearnerImportRunSchema,
  getAdminSchoolsLearnerImportJobSchema,
  getAdminSchoolsLearnerImportTemplateSchema,
} from "./schemas.js";
import { verifyJWT } from "@aivo/security";

// ---------------------------------------------------------------------------
// RBAC helper
// ---------------------------------------------------------------------------
const ALLOWED_ROLES = new Set(["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SCHOOL_ADMIN"]);

async function requireSchoolAdmin(
  req: any,
  reply: any,
): Promise<{ sub: string; role: string; email?: string } | null> {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  try {
    const payload = (await verifyJWT(auth.slice(7).trim())) as {
      sub: string;
      role: string;
      email?: string;
    };
    if (!ALLOWED_ROLES.has(payload.role)) {
      reply.code(403).send({ error: "forbidden", required_roles: [...ALLOWED_ROLES] });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory stores (per school learner set keyed by external_id)
// ---------------------------------------------------------------------------
// TODO(sprint6): Replace with Postgres persistence (dpa-store pattern).

type JobStatus = "pending" | "running" | "done" | "failed";

interface ImportJob {
  jobId: string;
  schoolId: string;
  status: JobStatus;
  progress: ImportProgress;
  csvText: string;
  validRows: NormalizedLearner[];
  errors?: string[];
}

const JOBS = new Map<string, ImportJob>();

// Per-school in-memory learner store: schoolId -> Map<external_id, NormalizedLearner>
const LEARNER_STORE = new Map<string, Map<string, NormalizedLearner>>();

function getSchoolLearners(schoolId: string): Map<string, NormalizedLearner> {
  let store = LEARNER_STORE.get(schoolId);
  if (!store) {
    store = new Map();
    LEARNER_STORE.set(schoolId, store);
  }
  return store;
}

/** Idempotent apply stub keyed by external_id — real DB upsert follows in Sprint 7. */
function makeApply(schoolId: string) {
  const learners = getSchoolLearners(schoolId);
  return (row: NormalizedLearner): "created" | "updated" | "skipped" => {
    if (learners.has(row.external_id)) {
      learners.set(row.external_id, row);
      return "updated";
    }
    learners.set(row.external_id, row);
    return "created";
  };
}

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function registerLearnerImportRoutes(app: FastifyInstance, db: any): void {
  // ------------------------------------------------------------------
  // POST /admin/schools/:schoolId/learners/import/validate
  // ------------------------------------------------------------------
  app.post<{
    Params: { schoolId: string };
    Body: { csvText: string; mapping?: Record<string, number> };
  }>(
    "/admin/schools/:schoolId/learners/import/validate",
    { schema: postAdminSchoolsLearnerImportValidateSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { csvText, mapping } = req.body ?? {};
      if (!csvText) {
        return reply.code(400).send({ error: "csvText is required" });
      }

      const result = validateCsv(csvText, mapping as any);
      const errorReportCsv = toErrorReportCsv(csvText, result);

      return {
        summary: result.summary,
        mapping: result.mapping,
        missingColumns: result.missingColumns,
        issues: result.issues,
        errorReportCsv,
      };
    },
  );

  // ------------------------------------------------------------------
  // POST /admin/schools/:schoolId/learners/import/run
  // ------------------------------------------------------------------
  app.post<{
    Params: { schoolId: string };
    Body: { csvText: string; mapping?: Record<string, number>; dryRun?: boolean; jobId?: string };
  }>(
    "/admin/schools/:schoolId/learners/import/run",
    { schema: postAdminSchoolsLearnerImportRunSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId } = req.params;
      const { csvText, mapping, dryRun, jobId: providedJobId } = req.body ?? {};

      if (!csvText) {
        return reply.code(400).send({ error: "csvText is required" });
      }

      const validation = validateCsv(csvText, mapping as any);
      const validRows = validation.valid;

      // Dry-run: return diff counts without persisting anything.
      if (dryRun) {
        const existingIds = new Set(getSchoolLearners(schoolId).keys());
        const diff = dryRunDiff(validRows, existingIds);
        return {
          dryRun: true,
          adds: diff.adds,
          updates: diff.updates,
          totalValid: validRows.length,
          summary: validation.summary,
        };
      }

      // Check for an existing resumable job with the same jobId.
      let job: ImportJob;
      if (providedJobId && JOBS.has(providedJobId)) {
        job = JOBS.get(providedJobId)!;
        if (job.schoolId !== schoolId) {
          return reply.code(404).send({ error: "job_not_found" });
        }
        // Resume from the stored cursor.
        job.status = "running";
        job.csvText = csvText;
        job.validRows = validRows;
      } else {
        const jobId = providedJobId ?? generateJobId();
        job = {
          jobId,
          schoolId,
          status: "running",
          progress: initialProgress(validRows.length),
          csvText,
          validRows,
        };
        JOBS.set(jobId, job);
      }

      const apply = makeApply(schoolId);

      // Run the import asynchronously in a setImmediate so we return jobId
      // quickly, while the engine processes chunks in the background.
      setImmediate(() => {
        try {
          const finalProgress = runImport(validRows, apply, {
            chunkSize: 500,
            resumeFrom: job.progress,
            onProgress: (p) => {
              job.progress = p;
            },
          });
          job.progress = finalProgress;
          job.status = "done";

          // Emit audit event upon completion.
          void logAuditEvent(db, {
            action: "learner_import_completed",
            actorId: actor.sub,
            actorEmail: actor.email ?? "unknown",
            actorRole: actor.role,
            resourceType: "learner_import",
            resourceId: job.jobId,
            details: {
              schoolId,
              ...finalProgress,
              totalRows: validation.summary.totalRows,
              errorRows: validation.summary.errorRows,
              warningRows: validation.summary.warningRows,
            },
          }).catch(() => {
            // Fire-and-forget; audit failure must not fail the import.
          });
        } catch (err) {
          job.status = "failed";
          job.errors = [(err as Error).message];
        }
      });

      return {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
      };
    },
  );

  // ------------------------------------------------------------------
  // GET /admin/schools/:schoolId/learners/import/template
  // NOTE: register before /:jobId so Fastify routes this correctly.
  // ------------------------------------------------------------------
  app.get<{ Params: { schoolId: string } }>(
    "/admin/schools/:schoolId/learners/import/template",
    { schema: getAdminSchoolsLearnerImportTemplateSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const csv = templateCsv();
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="learner-import-template.csv"');
      return csv;
    },
  );

  // ------------------------------------------------------------------
  // GET /admin/schools/:schoolId/learners/import/:jobId
  // ------------------------------------------------------------------
  app.get<{ Params: { schoolId: string; jobId: string } }>(
    "/admin/schools/:schoolId/learners/import/:jobId",
    { schema: getAdminSchoolsLearnerImportJobSchema },
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;

      const { schoolId, jobId } = req.params;
      const job = JOBS.get(jobId);
      if (!job || job.schoolId !== schoolId) {
        return reply.code(404).send({ error: "job_not_found", jobId });
      }

      return {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        summary: {
          total: job.progress.total,
          created: job.progress.created,
          updated: job.progress.updated,
          skipped: job.progress.skipped,
          done: job.progress.done,
        },
        errors: job.errors ?? null,
      };
    },
  );
}

// Exported for tests.
export function clearLearnerImportStoresForTest(): void {
  JOBS.clear();
  LEARNER_STORE.clear();
}
