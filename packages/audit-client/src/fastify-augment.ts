/**
 * Module augmentation so `audited(...)`'s `{ config: { audit } }` is accepted
 * by Fastify route options under strict type-providers (e.g. billing-svc).
 * Importing anything from `@aivo/audit-client` pulls this in.
 */
import type { FastifyContextConfig } from "fastify";
import type { AuditConfig } from "./audited.js";

// Reference the imported type so the module is resolved under NodeNext.
type _Base = FastifyContextConfig;

declare module "fastify" {
  interface FastifyContextConfig {
    audit?: AuditConfig;
  }
}
