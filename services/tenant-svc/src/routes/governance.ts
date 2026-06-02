import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";

// tenant-svc uses in-memory stores (no DB handle in buildApp).
// TODO(sprint5): if/when tenant-svc gains a Drizzle db handle, wire
// tenants/users rows keyed by subjectId here.
export function registerGovernanceRoutes(app: FastifyInstance): void {
  registerGovernanceSubscriber(app, {
    service: "tenant-svc",

    async erase(_req: GovernanceSubjectRequest): Promise<EraseResult> {
      // TODO(sprint5): tenant-svc has no DB handle in buildApp; wire once
      // a Drizzle db is injected.
      return { counts: {} };
    },

    async export(_req: GovernanceSubjectRequest): Promise<ExportResult> {
      // TODO(sprint5): tenant-svc has no DB handle in buildApp; wire once
      // a Drizzle db is injected.
      return { counts: {}, bundle: {} };
    },
  });
}
