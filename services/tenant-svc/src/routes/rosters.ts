import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import {
  createRosterImporterStores,
  importRoster,
  type ImportPayload,
  type RosterImporterStores,
} from "../services/roster-importer.js";

const STORES: RosterImporterStores = createRosterImporterStores();

export function getRosterStoresForTest(): RosterImporterStores {
  return STORES;
}

export function registerRosterRoutes(app: FastifyInstance): void {
  app.post<{ Body: ImportPayload }>("/api/rosters/import", async (request, reply) => {
    if (!request.body?.districtId) {
      return reply.code(400).send({ error: "districtId is required" });
    }
    // Sprint 09: emit audit at start AND completion of every import.
    void emitAuditEvent({
      actorRole: "district_admin",
      action: "sis_import_started",
      resourceType: "sis_import",
      resourceId: request.body.districtId,
      metadata: {
        schools: request.body.schools?.length ?? 0,
        classes: request.body.classes?.length ?? 0,
        enrollments: request.body.enrollments?.length ?? 0,
      },
    });
    const result = importRoster(request.body, STORES);
    void emitAuditEvent({
      actorRole: "district_admin",
      action: "sis_import_completed",
      resourceType: "sis_import",
      resourceId: result.jobId,
      metadata: {
        schoolsCreated: result.schoolsCreated,
        classesUpserted: result.classesUpserted,
        enrollmentsUpserted: result.enrollmentsUpserted,
        teachersAssigned: result.teachersAssigned,
        studentsAdded: result.studentsAdded,
        warningsCount: result.warnings.length,
        preservedParentOwnedFields: result.preservedParentOwnedFields,
      },
    });
    return reply.send(result);
  });
}
