import type { FastifyInstance } from "fastify";
import { createCleverAdapterFromExport } from "../services/clever-adapter.js";
import { createClassLinkAdapterFromExport } from "../services/classlink-adapter.js";
import type { NormalizedRosterExport } from "../services/sis-provider-interface.js";

export function registerSisRoutes(app: FastifyInstance): void {
  app.post<{
    Body: { vendor: "clever" | "classlink"; export: NormalizedRosterExport };
  }>("/api/sis/import-export", async (request, reply) => {
    if (!request.body?.vendor || !request.body?.export) {
      return reply.code(400).send({ error: "vendor and export are required" });
    }
    // Tenant scope: a SIS import always targets exactly one tenant.
    // The enterprise auth hook (registerEnterpriseAuthHook) places
    // tenantId on request.auth; refuse the import if it's missing so
    // we never normalize a roster into the wrong tenant boundary.
    const tenantId = (request as any).auth?.tenantId ?? null;
    if (!tenantId) {
      return reply.code(400).send({ error: "tenantId is required (auth context)" });
    }
    const provider =
      request.body.vendor === "clever"
        ? createCleverAdapterFromExport(request.body.export)
        : createClassLinkAdapterFromExport(request.body.export);
    const [schools, teachers, students, classes, enrollments] = await Promise.all([
      provider.listSchools(),
      provider.listTeachers(),
      provider.listStudents(),
      provider.listClasses(),
      provider.listEnrollments(),
    ]);
    return {
      vendor: provider.name,
      tenantId,
      summary: {
        schools: schools.length,
        teachers: teachers.length,
        students: students.length,
        classes: classes.length,
        enrollments: enrollments.length,
      },
    };
  });
}
