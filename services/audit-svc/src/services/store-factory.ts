/**
 * Sprint 12.5 boot-time store selector for audit-svc.
 *
 * Extracted so unit tests can exercise the production guard without
 * dragging the full server bootstrap into the import graph.
 */
import { createDb } from "@aivo/db";
import { DrizzleAuditStore } from "./drizzle-audit-store.js";
import { InMemoryAuditStore } from "./audit-store.js";

export function selectAuditStore() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new DrizzleAuditStore(createDb(databaseUrl));
  }
  if (process.env.NODE_ENV === "production") {
    const msg =
      "audit-svc: DATABASE_URL is required in production. Refusing to " +
      "boot with the in-memory store — audit events would be lost on " +
      "every restart, breaking the tamper-evident chain.";
    console.error(msg);
    throw new Error(msg);
  }
  return new InMemoryAuditStore();
}
