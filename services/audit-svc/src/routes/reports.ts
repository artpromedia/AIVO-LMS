import type { FastifyInstance } from "fastify";
import type { AuditStore } from "../services/audit-store.js";

export function registerAuditReportRoutes(app: FastifyInstance, store: AuditStore): void {
  app.get("/api/audit-reports/counts-by-action", async () => {
    const counts = await store.countByAction();
    return { counts };
  });
}
