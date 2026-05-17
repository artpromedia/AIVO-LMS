import { createDb } from "@aivo/db";
import { buildApp } from "./server.js";
import { InMemoryAuditStore } from "./services/audit-store.js";
import { DrizzleAuditStore } from "./services/drizzle-audit-store.js";

export { buildApp } from "./server.js";
export * from "./services/audit-store.js";
export * from "./services/audit-redaction.js";
export * from "./services/audit-client.js";
export { DrizzleAuditStore } from "./services/drizzle-audit-store.js";

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
  const store = databaseUrl
    ? new DrizzleAuditStore(createDb(databaseUrl))
    : new InMemoryAuditStore();
  buildApp({ store })
    .then((app) => app.listen({ port: PORT, host: "0.0.0.0" }))
    .then(() => {
      console.log(
        `Audit service listening on port ${PORT} (store: ${databaseUrl ? "drizzle" : "in-memory"})`,
      );
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
