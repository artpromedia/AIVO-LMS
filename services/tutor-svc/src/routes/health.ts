import { FastifyInstance } from "fastify";
import { tutorHealthRootSchema, getTutorsHealthSchema } from "./schemas.js";

/**
 * Sprint 08 production certification stamp.
 *
 * The values are captured at module-load and surfaced via
 * `GET /api/tutors/version`. `BUILD_COMMIT` and `BUILD_TIMESTAMP` are
 * baked in at image-build time by the deploy script; defaults are
 * provided so local dev still returns a meaningful response. The
 * `SPRINT_VERSION` constant is the source of truth for what the
 * production smoke harness expects.
 */
const SPRINT_VERSION = "sprint-08";
const BUILD_COMMIT = process.env.BUILD_COMMIT ?? "dev";
const BUILD_TIMESTAMP = process.env.BUILD_TIMESTAMP ?? new Date().toISOString();

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({ status: "ok", service: "tutor-svc" });
  app.get("/health", { schema: tutorHealthRootSchema }, handler);
  app.get("/api/tutors/health", { schema: getTutorsHealthSchema }, handler);

  // Public version stamp — readable without auth so the production
  // smoke harness can certify the deployed image without provisioning
  // a learner JWT. Allowlisted in `lib/tenant.ts`.
  app.get("/api/tutors/version", async () => ({
    service: "tutor-svc",
    sprint: SPRINT_VERSION,
    commit: BUILD_COMMIT,
    builtAt: BUILD_TIMESTAMP,
  }));
}
