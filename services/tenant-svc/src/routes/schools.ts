import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { tenantServiceSchools } from "../persistence.js";

interface SchoolRecord {
  id: string;
  districtId: string;
  name: string;
  externalId?: string;
}

const SCHOOLS = new Map<string, SchoolRecord>();

export function clearSchoolsForTest(): void {
  SCHOOLS.clear();
}

export function registerSchoolRoutes(app: FastifyInstance, db?: any): void {
  app.post<{
    Params: { districtId: string };
    Body: { name: string; externalId?: string };
  }>("/api/districts/:districtId/schools", async (request, reply) => {
    if (!request.body?.name) {
      return reply.code(400).send({ error: "name is required" });
    }
    if (db) {
      const [record] = await db
        .insert(tenantServiceSchools)
        .values({
          districtId: request.params.districtId,
          name: request.body.name,
          externalId: request.body.externalId ?? null,
        })
        .returning();
      return reply.code(201).send(record);
    }
    const record: SchoolRecord = {
      id: randomUUID(),
      districtId: request.params.districtId,
      name: request.body.name,
      externalId: request.body.externalId,
    };
    SCHOOLS.set(record.id, record);
    return reply.code(201).send(record);
  });

  app.get<{ Params: { districtId: string } }>(
    "/api/districts/:districtId/schools",
    async (request) => {
      const schools = db
        ? await db
            .select()
            .from(tenantServiceSchools)
            .where(eq(tenantServiceSchools.districtId, request.params.districtId))
        : Array.from(SCHOOLS.values()).filter((s) => s.districtId === request.params.districtId);
      return { schools };
    },
  );
}
