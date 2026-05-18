import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createDb } from "@aivo/db";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerHomeworkSessionRoutes } from "./routes/homework-sessions.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { defaultHomeworkOcrProvider, type HomeworkOcrProvider } from "./services/homework-ocr.js";

export interface BuildAppOptions {
  ocrProvider?: HomeworkOcrProvider;
  skipAuth?: boolean;
  /** Optional drizzle client. When provided (or DATABASE_URL is set),
   *  every session-start writes a row to homework_assignments +
   *  homework_sessions so the practice session survives restart and
   *  is queryable by sibling services. Without it, sessions stay
   *  in-memory only — acceptable for tests, refused in production. */
  db?: any;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "homework-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "homework-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "homework-svc" });
  }

  const db = options.db ?? (process.env.DATABASE_URL ? createDb(process.env.DATABASE_URL) : null);
  if (!db && process.env.NODE_ENV === "production") {
    throw new Error(
      "homework-svc: DATABASE_URL required in production. In-memory-only " +
        "sessions are forbidden because they vanish on restart and break " +
        "compliance audits.",
    );
  }

  registerHomeworkSessionRoutes(app, db);
  registerUploadRoutes(app, options.ocrProvider ?? defaultHomeworkOcrProvider);
  return app;
}
