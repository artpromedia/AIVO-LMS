/**
 * Sprint 12.5 boot-time store selector.
 *
 * Extracted from `src/index.ts` so unit tests can exercise the
 * production guard without dragging the full server bootstrap (and its
 * cross-package imports) into the import graph.
 */
import { createDb } from "@aivo/db";
import { DrizzleProblemSessionStore } from "./drizzle-problem-session-store.js";
import { InMemoryProblemSessionStore } from "./problem-session-store.js";

export function selectProblemSessionStore() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new DrizzleProblemSessionStore(createDb(databaseUrl));
  }
  if (process.env.NODE_ENV === "production") {
    const msg =
      "problem-session-svc: DATABASE_URL is required in production. " +
      "Refusing to boot with the in-memory store — learner sessions would " +
      "be lost on every restart.";
    console.error(msg);
    throw new Error(msg);
  }
  return new InMemoryProblemSessionStore();
}
