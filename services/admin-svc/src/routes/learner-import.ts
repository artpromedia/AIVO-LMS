/**
 * Sprint 6 — Learner bulk-import routes (admin-svc).
 *
 * Backed by @aivo/learner-import for CSV parsing, validation, and the
 * resumable chunked engine. Job state and imported learner rows are
 * persisted via a LearnerImportStore (Postgres in production, in-memory for
 * tests / local dev) following the dpa-store precedent in data-governance-svc.
 * Jobs survive restart and learner rows upsert idempotently on
 * (schoolId, external_id).
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
} from "@aivo/learner-import";
import { logAuditEvent } from "./audit.js";
import {
  type ImportJobRecord,
  type LearnerImportStore,
  InMemoryLearnerImportStore,
  selectLearnerImportStore,
} from "../stores/learner-import-store.js";
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

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build a synchronous `apply` for the chunked engine. The engine's apply
 * must be sync, so we classify each row against the pre-loaded set of
 * existing external_ids and stage the row for a single bulk upsert once the
 * run completes. Idempotent: a row reprocessed after a resume maps to the
 * same external_id and upserts in place.
 */
function makeStagingApply(existingIds: Set<string>, staged: Map<string, NormalizedLearner>) {
  return (row: NormalizedLearner): "created" | "updated" | "skipped" => {
    const outcome = existingIds.has(row.external_id) ? "updated" : "created";
    existingIds.add(row.external_id);
    staged.set(row.external_id, row);
    return outcome;
  };
}

// Test-only handle to the in-memory store, set when registerLearnerImportRoutes
// selects it (non-production, no DATABASE_URL).
let testStore: InMemoryLearnerImportStore | null = null;
export function clearLearnerImportStoresForTest(): void {
  testStore?.clear();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function registerLearnerImportRoutes(
  app: FastifyInstance,
  db: any,
  store: LearnerImportStore = selectLearnerImportStore(db),
): void {
  if (store instanceof InMemoryLearnerImportStore) testStore = store;
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

      // Existing external_ids for this school — used for dry-run diff and
      // for created/updated classification during the real run.
      const existingIds = await store.existingExternalIds(schoolId);

      // Dry-run: return diff counts without persisting anything.
      if (dryRun) {
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
      let job: ImportJobRecord;
      if (providedJobId) {
        const existing = await store.getJob(providedJobId);
        if (existing) {
          if (existing.schoolId !== schoolId) {
            return reply.code(404).send({ error: "job_not_found" });
          }
          // Resume from the stored cursor.
          job = { ...existing, status: "running" };
        } else {
          job = {
            jobId: providedJobId,
            schoolId,
            status: "running",
            progress: initialProgress(validRows.length),
          };
        }
      } else {
        job = {
          jobId: generateJobId(),
          schoolId,
          status: "running",
          progress: initialProgress(validRows.length),
        };
      }
      await store.saveJob(job);

      // Stage processed rows for a single idempotent bulk upsert once the
      // chunked run finishes.
      const staged = new Map<string, NormalizedLearner>();
      const apply = makeStagingApply(existingIds, staged);

      // Run the import asynchronously in a setImmediate so we return jobId
      // quickly, while the engine processes chunks in the background.
      setImmediate(() => {
        void (async () => {
          try {
            const finalProgress = runImport(validRows, apply, {
              chunkSize: 500,
              resumeFrom: job.progress,
              onProgress: (p) => {
                job.progress = p;
              },
            });

            // Persist the imported learner rows, then mark the job done.
            await store.upsertLearners(schoolId, [...staged.values()]);
            job.progress = finalProgress;
            job.status = "done";
            await store.saveJob(job);

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
            await store.saveJob(job).catch(() => {
              // Best-effort; the in-flight error is already surfaced above.
            });
          }
        })();
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
      const job = await store.getJob(jobId);
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
