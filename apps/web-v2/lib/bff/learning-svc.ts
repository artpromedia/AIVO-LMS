/**
 * Server-side helper that fronts `services/learning-svc` from the BFF.
 *
 * Wraps `@aivo/api-client/learning` with the auth header forwarding and
 * service-token handling the BFF needs. Browser code MUST NOT import
 * this module — it leaks the service token. Always go through a
 * `/api/bff/learning/...` route handler.
 */
import { createLearningClient, type LearningClient } from "@aivo/api-client/learning";

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd()) throw new Error(`${name} must be set in production`);
  return devDefault;
}

function getLearningSvcUrl(): string {
  return requireUrl("LEARNING_SVC_URL", "http://localhost:3041");
}

let cached: LearningClient | null = null;

/**
 * Returns a singleton learning-svc client bound to the configured base
 * URL. Passing an `Authorization` header forwards the caller's bearer
 * token (mock or otherwise) to the upstream service so per-learner
 * scope is enforced there as well.
 */
export function getServerLearningClient(authHeader?: string | null): LearningClient {
  if (cached && !authHeader) return cached;
  const client = createLearningClient({
    baseUrl: getLearningSvcUrl(),
    headers: {
      ...(authHeader ? { authorization: authHeader } : {}),
      ...(process.env.LEARNING_SVC_SERVICE_TOKEN
        ? { "x-service-token": process.env.LEARNING_SVC_SERVICE_TOKEN }
        : {}),
    },
  });
  if (!authHeader) cached = client;
  return client;
}
