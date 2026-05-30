/**
 * Drizzle-backed WeeklyCurriculumStore — REAL implementation.
 *
 * Backed by the shared `curriculum_uploads` table (packages/db,
 * migration 0028). This is the same table `tutor-svc` reads/writes, so
 * web-v2 and tutor-svc share a single source of truth: an upload saved
 * here is visible to the tutor-svc chat/homework paths and vice-versa.
 *
 * Interop notes:
 *   - tutor-svc persists `status` as uppercase ("ACTIVE"/"ARCHIVED") and
 *     `uploader_role` as uppercase ("PARENT"/"TEACHER"/...). We write the
 *     same wire format and normalize to web-v2's lowercase enums on read so
 *     rows written by either service round-trip correctly.
 *
 * Enabled by AIVO_PERSISTENCE=postgres (or AIVO_PERSISTENCE_WEEKLY_CURRICULUM
 * =postgres). Requires DATABASE_URL + a migrated DB.
 */
import { and, desc, eq, or } from "drizzle-orm";
import { getDb, curriculumUploads } from "@aivo/db";
import type { WeeklyCurriculumStore } from "../types";
import type { CurriculumFocus, CurriculumUpload } from "@/lib/db/types";

// Resolve the Drizzle client lazily so importing this module never crashes a
// memory-mode boot (which has no DATABASE_URL).
let _db: ReturnType<typeof getDb> | null = null;
function db() {
  return (_db ??= getDb());
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return v ? String(v) : new Date().toISOString();
}
function toIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function normRole(v: unknown): CurriculumUpload["uploaderRole"] {
  const s = String(v ?? "parent").toLowerCase();
  if (
    s === "parent" ||
    s === "teacher" ||
    s === "caregiver" ||
    s === "school_admin" ||
    s === "district_admin"
  ) {
    return s;
  }
  return "parent";
}
function normStatus(v: unknown): CurriculumUpload["status"] {
  return String(v ?? "active").toLowerCase() === "archived" ? "archived" : "active";
}
function normSourceType(v: unknown): CurriculumUpload["sourceType"] {
  return String(v ?? "text").toLowerCase() === "file" ? "file" : "text";
}

function rowToUpload(row: typeof curriculumUploads.$inferSelect): CurriculumUpload {
  const focus = (row.parsedFocus ?? {}) as Partial<CurriculumFocus>;
  return {
    id: row.id,
    tenantId: row.tenantId ?? "",
    learnerId: row.learnerId,
    uploadedBy: row.uploadedBy,
    uploaderRole: normRole(row.uploaderRole),
    subject: row.subject,
    title: row.title ?? focus.title ?? "This week's lessons",
    sourceType: normSourceType(row.sourceType),
    fileName: row.fileName ?? null,
    rawText: row.rawText ?? "",
    parsedFocus: {
      title: focus.title ?? row.title ?? "This week's lessons",
      subject: focus.subject ?? row.subject,
      weekStart: focus.weekStart ?? toIsoOrNull(row.weekStart)?.slice(0, 10) ?? null,
      weekEnd: focus.weekEnd ?? toIsoOrNull(row.weekEnd)?.slice(0, 10) ?? null,
      topics: Array.isArray(focus.topics) ? focus.topics : [],
      keywords: Array.isArray(focus.keywords) ? focus.keywords : [],
      standards: Array.isArray(focus.standards) ? focus.standards : [],
      skills: Array.isArray(focus.skills) ? focus.skills : [],
      summary: typeof focus.summary === "string" ? focus.summary : "",
      confidence: typeof focus.confidence === "number" ? focus.confidence : 0,
    },
    weekStart: toIsoOrNull(row.weekStart),
    weekEnd: toIsoOrNull(row.weekEnd),
    status: normStatus(row.status),
    notes: row.notes ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export const drizzleWeeklyCurriculum: WeeklyCurriculumStore = {
  async listForLearner(learnerId, tenantId, opts) {
    const conds = [
      eq(curriculumUploads.learnerId, learnerId),
      eq(curriculumUploads.tenantId, tenantId),
    ];
    if (opts?.subject) conds.push(eq(curriculumUploads.subject, opts.subject));
    if (opts?.status) {
      // Match either case written by web-v2 or tutor-svc.
      conds.push(
        or(
          eq(curriculumUploads.status, opts.status),
          eq(curriculumUploads.status, opts.status.toUpperCase()),
        )!,
      );
    }
    const rows = await db()
      .select()
      .from(curriculumUploads)
      .where(and(...conds))
      .orderBy(desc(curriculumUploads.createdAt))
      .limit(50);
    return rows.map(rowToUpload);
  },

  async getById(uploadId, tenantId) {
    const [row] = await db()
      .select()
      .from(curriculumUploads)
      .where(and(eq(curriculumUploads.id, uploadId), eq(curriculumUploads.tenantId, tenantId)))
      .limit(1);
    return row ? rowToUpload(row) : null;
  },

  async create({ upload, archiveSupersededBefore }) {
    const startMs = archiveSupersededBefore ? new Date(archiveSupersededBefore).getTime() : null;
    const newIsFuture = startMs != null && startMs > Date.now();

    return db().transaction(async (tx) => {
      // Archive prior ACTIVE rows for the same (learner, subject). When the new
      // plan is future-dated, leave a still-current plan in place (only archive
      // rows that already ended before the new plan starts).
      const existing = await tx
        .select()
        .from(curriculumUploads)
        .where(
          and(
            eq(curriculumUploads.learnerId, upload.learnerId),
            eq(curriculumUploads.tenantId, upload.tenantId),
            eq(curriculumUploads.subject, upload.subject),
            or(
              eq(curriculumUploads.status, "active"),
              eq(curriculumUploads.status, "ACTIVE"),
            )!,
          ),
        );
      for (const row of existing) {
        const endMs = row.weekEnd
          ? new Date(row.weekEnd as unknown as string).getTime() + 24 * 3600 * 1000
          : Infinity;
        if (!newIsFuture || (startMs != null && endMs <= startMs)) {
          await tx
            .update(curriculumUploads)
            .set({ status: "ARCHIVED", updatedAt: new Date() })
            .where(eq(curriculumUploads.id, row.id));
        }
      }

      const [inserted] = await tx
        .insert(curriculumUploads)
        .values({
          id: upload.id,
          tenantId: upload.tenantId,
          learnerId: upload.learnerId,
          uploadedBy: upload.uploadedBy,
          // Uppercase wire format to match tutor-svc rows.
          uploaderRole: upload.uploaderRole.toUpperCase(),
          subject: upload.subject,
          title: upload.title,
          sourceType: upload.sourceType,
          fileName: upload.fileName,
          rawText: upload.rawText,
          parsedFocus: upload.parsedFocus,
          weekStart: upload.weekStart ? new Date(upload.weekStart) : null,
          weekEnd: upload.weekEnd ? new Date(upload.weekEnd) : null,
          status: "ACTIVE",
          notes: upload.notes,
        })
        .returning();
      return rowToUpload(inserted);
    });
  },

  async delete(uploadId, tenantId) {
    const deleted = await db()
      .delete(curriculumUploads)
      .where(and(eq(curriculumUploads.id, uploadId), eq(curriculumUploads.tenantId, tenantId)))
      .returning({ id: curriculumUploads.id });
    return deleted.length > 0;
  },
};
