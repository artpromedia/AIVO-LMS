import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { audited } from "@aivo/audit-client";
import { tenantServiceDistricts } from "../persistence.js";

interface DistrictRecord {
  id: string;
  name: string;
  externalId?: string;
}

const DISTRICTS = new Map<string, DistrictRecord>();

export function clearDistrictsForTest(): void {
  DISTRICTS.clear();
}

export function registerDistrictRoutes(app: FastifyInstance, db?: any): void {
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
      if (db) {
        const [record] = await db
          .insert(tenantServiceDistricts)
          .values({ name: request.body.name, externalId: request.body.externalId ?? null })
          .returning();
        return reply.code(201).send(record);
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

  app.get("/api/districts", async () => ({
    districts: db ? await db.select().from(tenantServiceDistricts) : Array.from(DISTRICTS.values()),
  }));
}
