import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import { getRosterStores } from "./rosters.js";
import { eraseRosterSubject, exportRosterSubject } from "../persistence.js";

/**
 * DSAR (erase / export) handlers for tenant-svc.
 *
 * tenant-svc has no Drizzle handle; the only subject-linked data it holds is
 * the in-memory SIS roster imported via /api/rosters/import — student records
 * keyed by external id plus the class enrollments that reference them. The
 * handlers below scope to a single subject by treating `subjectId` as the
 * student's external id and operate over those shared stores.
 *
 * The roster stores are ephemeral (lost on restart). When tenant-svc gains a
 * durable Drizzle handle these handlers should additionally erase/export the
 * persisted tenant/user rows; the in-memory sweep below remains correct.
 */
export function registerGovernanceRoutes(app: FastifyInstance, db?: any): void {
  registerGovernanceSubscriber(app, {
    service: "tenant-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (db) return { counts: await eraseRosterSubject(db, req.subjectId, req.tenantId) };
      const stores = getRosterStores();
      const subjectId = req.subjectId;
      const counts: Record<string, number> = {};

      // Remove the SIS student record for this subject, if present.
      if (stores.existingStudents.delete(subjectId)) {
        counts.roster_students = 1;
      }

      // Drop the subject from every class enrollment set.
      let enrollmentsRemoved = 0;
      for (const [classExternalId, studentIds] of stores.enrollments) {
        if (studentIds.delete(subjectId)) {
          enrollmentsRemoved += 1;
          if (studentIds.size === 0) stores.enrollments.delete(classExternalId);
        }
      }
      if (enrollmentsRemoved > 0) counts.roster_enrollments = enrollmentsRemoved;

      return { counts };
    },

    async export(req: GovernanceSubjectRequest): Promise<ExportResult> {
      if (db) return exportRosterSubject(db, req.subjectId, req.tenantId);
      const stores = getRosterStores();
      const subjectId = req.subjectId;

      const student = stores.existingStudents.get(subjectId) ?? null;
      const enrolledClasses: string[] = [];
      for (const [classExternalId, studentIds] of stores.enrollments) {
        if (studentIds.has(subjectId)) enrolledClasses.push(classExternalId);
      }

      const counts: Record<string, number> = {};
      if (student) counts.roster_students = 1;
      if (enrolledClasses.length > 0) counts.roster_enrollments = enrolledClasses.length;

      return {
        counts,
        bundle: {
          roster_student: student,
          roster_enrollments: enrolledClasses,
        },
      };
    },
  });
}
