import { buildApp } from "./server.js";
import { createDb } from "@aivo/db";
import { DrizzleProblemSessionStore } from "./services/drizzle-problem-session-store.js";
import { InMemoryProblemSessionStore } from "./services/problem-session-store.js";

export { buildApp } from "./server.js";
export * from "./services/problem-session-store.js";
export * from "./services/problem-session-redaction.js";
export * from "./services/problem-session-scoring.js";
export * from "./services/problem-session-client.js";
export { DrizzleProblemSessionStore } from "./services/drizzle-problem-session-store.js";

const PORT = parseInt(process.env.PROBLEM_SESSION_PORT || "3061", 10);

async function start() {
  // Production wiring: when DATABASE_URL is set, persist to Postgres.
  // In dev / smoke containers without a database we fall back to the
  // in-memory store so the service still boots — but never in production,
  // where it would silently lose session/attempt data on restart.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && process.env.NODE_ENV === "production") {
    throw new Error(
      "problem-session-svc: DATABASE_URL must be set in production. The " +
        "in-memory store is development-only (attempt data is lost on restart " +
        "and not shared across replicas).",
    );
  }
  const store = databaseUrl
    ? new DrizzleProblemSessionStore(createDb(databaseUrl))
    : new InMemoryProblemSessionStore();
  const app = await buildApp({ store });
  await app.listen({ port: PORT, host: "0.0.0.0" });

  console.log(
    `Problem session service listening on port ${PORT} (store: ${databaseUrl ? "drizzle" : "in-memory"})`,
  );
}

const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
