import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

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

export function registerClassRoutes(app: FastifyInstance): void {
  app.post<{
    Params: { schoolId: string };
    Body: { name: string; externalId?: string };
  }>("/api/schools/:schoolId/classes", async (request, reply) => {
    if (!request.body?.name) {
      return reply.code(400).send({ error: "name is required" });
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
