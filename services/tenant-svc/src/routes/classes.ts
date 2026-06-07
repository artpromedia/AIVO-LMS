import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { tenantServiceClasses, tenantServiceSchools } from "../persistence.js";

interface ClassRecord {
  id: string;
  schoolId: string;
  name: string;
  externalId?: string;
}

const CLASSES = new Map<string, ClassRecord>();

export function clearClassesForTest(): void {
  CLASSES.clear();
}

export function registerClassRoutes(app: FastifyInstance, db?: any): void {
  app.post<{
    Params: { schoolId: string };
    Body: { name: string; externalId?: string };
  }>("/api/schools/:schoolId/classes", async (request, reply) => {
    if (!request.body?.name) {
      return reply.code(400).send({ error: "name is required" });
    }
    if (db) {
      const [school] = await db
        .select({ districtId: tenantServiceSchools.districtId })
        .from(tenantServiceSchools)
        .where(eq(tenantServiceSchools.id, request.params.schoolId))
        .limit(1);
      if (!school) return reply.code(404).send({ error: "school not found" });
      const [record] = await db
        .insert(tenantServiceClasses)
        .values({
          districtId: school.districtId,
          schoolId: request.params.schoolId,
          name: request.body.name,
          externalId: request.body.externalId ?? null,
        })
        .returning();
      return reply.code(201).send(record);
    }
    const record: ClassRecord = {
      id: randomUUID(),
      schoolId: request.params.schoolId,
      name: request.body.name,
      externalId: request.body.externalId,
    };
    CLASSES.set(record.id, record);
    return reply.code(201).send(record);
  });
}
