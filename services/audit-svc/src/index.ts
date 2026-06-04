import { createDb } from "@aivo/db";
import { buildApp } from "./server.js";
import { InMemoryAuditStore } from "./services/audit-store.js";
import { DrizzleAuditStore } from "./services/drizzle-audit-store.js";
import { InMemoryEventStore } from "./services/event-store.js";
import { DrizzleEventStore } from "./services/drizzle-event-store.js";

export { buildApp } from "./server.js";
export * from "./services/audit-store.js";
export * from "./services/audit-redaction.js";
export * from "./services/audit-client.js";
export { DrizzleAuditStore } from "./services/drizzle-audit-store.js";
export { DrizzleEventStore } from "./services/drizzle-event-store.js";
export * from "./jobs/anchor.js";
export * from "./jobs/tamper.js";
export * from "./jobs/retention.js";

const PORT = parseInt(process.env.AUDIT_PORT || "3069", 10);

const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const databaseUrl = process.env.DATABASE_URL;
  // The in-memory store is a dev affordance only — audit events would be lost
  // on restart and not shared across replicas. An audit trail that silently
  // evaporates is worse than none, so refuse to boot without a database in
  // production.
  if (!databaseUrl && process.env.NODE_ENV === "production") {
    throw new Error(
      "audit-svc: DATABASE_URL must be set in production. The in-memory audit " +
        "store is development-only (events are lost on restart and not shared " +
        "across replicas).",
    );
  }
  const db = databaseUrl ? createDb(databaseUrl) : null;
  const store = db ? new DrizzleAuditStore(db) : new InMemoryAuditStore();
  const eventStore = db ? new DrizzleEventStore(db) : new InMemoryEventStore();
  buildApp({ store, eventStore })
    .then(async (app) => {
      await app.listen({ port: PORT, host: "0.0.0.0" });
      console.log(
        `Audit service listening on port ${PORT} (store: ${databaseUrl ? "drizzle" : "in-memory"})`,
      );
      // Nightly integrity + anchor + retention via the shared safe-cron.
      // Best-effort: a scheduler import failure must not take the API down.
      try {
        const { startSafeCron, createDrizzleAdvisoryLock, createDrizzleLedger } =
          await import("@aivo/scheduling");
        const { runTamperCheckOnce } = await import("./jobs/tamper.js");
        if (db) {
          const lock = createDrizzleAdvisoryLock(db as never);
          const ledger = createDrizzleLedger(db as never);
          startSafeCron({
            jobName: "audit.tamper-check",
            lock,
            ledger,
            log: console as never,
            run: async () => {
              const brk = await runTamperCheckOnce(eventStore, {
                alert: async (b) => console.error("[audit] CHAIN BREAK", b),
              });
              return { status: "ok", sent: brk ? 1 : 0, failed: 0 };
            },
          });
        }
      } catch (e) {
        console.error("[audit] failed to start integrity cron", e);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
export { S3WormStore } from "./jobs/worm-s3.js";
