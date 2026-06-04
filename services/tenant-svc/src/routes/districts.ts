import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { audited } from "@aivo/audit-client";

interface DistrictRecord {
  id: string;
  name: string;
  externalId?: string;
}

const DISTRICTS = new Map<string, DistrictRecord>();

export function clearDistrictsForTest(): void {
  DISTRICTS.clear();
}

export function registerDistrictRoutes(app: FastifyInstance): void {
  app.post<{ Body: { name: string; externalId?: string } }>(
    "/api/districts",
    {
      ...audited("tenant.district.created", {
        entityType: "district",
        entityId: (req) => (req.body as { name?: string })?.name ?? "",
        detailsAllowlist: ["name", "externalId"],
        details: (req) => ({
          name: (req.body as { name?: string })?.name,
          externalId: (req.body as { externalId?: string })?.externalId,
        }),
      }),
    },
    async (request, reply) => {
      if (!request.body?.name) {
        return reply.code(400).send({ error: "name is required" });
      }
      const record: DistrictRecord = {
        id: randomUUID(),
        name: request.body.name,
        externalId: request.body.externalId,
      };
      DISTRICTS.set(record.id, record);
      return reply.code(201).send(record);
    },
  );

  app.get("/api/districts", async () => ({ districts: Array.from(DISTRICTS.values()) }));
}
