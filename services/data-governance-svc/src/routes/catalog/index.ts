/**
 * Data-class catalog route (Sprint 5). Read-only: lists every data class,
 * its owning service, sensitivity tier, and the effective retention rule.
 */
import type { FastifyInstance } from "fastify";
import { actorOf, isPlatformAdmin, isDistrictAdmin } from "../context.js";
import { listCatalog, getRetentionPolicy } from "../../services/catalog-store.js";

export function registerCatalogRoutes(app: FastifyInstance): void {
  app.get("/catalog", async (request, reply) => {
    const actor = actorOf(request);
    if (!isPlatformAdmin(actor) && !isDistrictAdmin(actor)) {
      return reply.code(403).send({ error: "admin role required" });
    }
    const tenantId = isPlatformAdmin(actor) ? null : actor.tenantId;
    const classes = await Promise.all(
      listCatalog().map(async (c) => {
        const policy = await getRetentionPolicy(c.dataClass, tenantId);
        return {
          ...c,
          retention: {
            retentionDays: policy.retentionDays,
            disposition: policy.disposition,
            legalHold: policy.legalHold,
          },
        };
      }),
    );
    return { catalog: classes };
  });
}
