import { buildApp } from "./server.js";
import { selectProblemSessionStore } from "./services/store-factory.js";

export { buildApp } from "./server.js";
export * from "./services/problem-session-store.js";
export * from "./services/problem-session-redaction.js";
export * from "./services/problem-session-scoring.js";
export * from "./services/problem-session-client.js";
export { DrizzleProblemSessionStore } from "./services/drizzle-problem-session-store.js";
export { selectProblemSessionStore } from "./services/store-factory.js";

const PORT = parseInt(process.env.PROBLEM_SESSION_PORT || "3061", 10);

async function start() {
  // Production wiring: when DATABASE_URL is set, persist to Postgres.
  // Without DATABASE_URL we fall back to the in-memory store in dev /
  // smoke containers; production hard-fails (see selectProblemSessionStore).
  const store = selectProblemSessionStore();
  const databaseUrl = process.env.DATABASE_URL;
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
    // Hard exit so orchestrators (k8s, fly.io, …) restart-loop loud and
    // visible — the in-memory fallback path must never silently win.
    process.exit(1);
  });
}
