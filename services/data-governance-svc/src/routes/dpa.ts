import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import {
  InMemoryDpaStore,
  selectDpaStore,
  type DpaAcceptanceInput,
  type DpaStore,
} from "../services/dpa-store.js";

// Default store: in-memory for tests / local dev. Production replaces
// this via `setDpaStore(...)` at boot with a PostgresDpaStore wrapping
// the drizzle client constructed from DATABASE_URL.
let STORE: DpaStore = new InMemoryDpaStore();

/** Override the module-level store. Called from server boot with a
 *  Postgres-backed implementation when DATABASE_URL is configured. */
export function setDpaStore(store: DpaStore): void {
  STORE = store;
}

/** Initialize the store from a (possibly absent) drizzle client.
 *  In production with no client, throws — DPA records must persist. */
export function initDpaStoreFromDb(db: any | null | undefined): void {
  STORE = selectDpaStore(db);
}

export function getDpaStoreForTest(): DpaStore {
  return STORE;
}

export function registerDpaRoutes(app: FastifyInstance): void {
  app.post<{ Body: DpaAcceptanceInput }>("/api/dpa/accept", async (request, reply) => {
    const body = request.body;
    if (!body?.districtId || !body?.version || !body?.acceptedById || !body?.acceptedByRole) {
      return reply.code(400).send({ error: "Missing required DPA fields" });
    }
    // Tenant scope: a DPA acceptance always belongs to a tenant (the
    // district's account). The enterprise auth hook puts tenantId on
    // request.auth; refuse the call if it's missing so a record cannot
    // be filed against the wrong tenant boundary.
    const tenantId = (request as any).auth?.tenantId ?? null;
    if (!tenantId) {
      return reply.code(400).send({ error: "tenantId is required (auth context)" });
    }
    const record = await Promise.resolve(STORE.acceptDpa(body));
    void emitAuditEvent({
      actorId: body.acceptedById,
      actorRole: body.acceptedByRole,
      action: "dpa_accepted",
      resourceType: "dpa",
      resourceId: record.id,
      metadata: {
        districtId: record.districtId,
        version: record.version,
      },
    });
    return reply.code(201).send(record);
  });

  app.get<{ Params: { districtId: string } }>(
    "/api/dpa/:districtId/latest",
    async (request, reply) => {
      const record = await Promise.resolve(STORE.latestForDistrict(request.params.districtId));
      if (!record) return reply.code(404).send({ error: "No DPA acceptance found" });
      return record;
    },
  );
}
