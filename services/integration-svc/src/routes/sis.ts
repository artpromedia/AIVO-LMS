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
