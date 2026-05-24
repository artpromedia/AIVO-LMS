/**
 * Typed Learning service client. Generated from the Zod/JSON Schema
 * definitions in `services/learning-svc/src/routes/sessions.ts` and
 * pinned against drift by `__tests__/schema-pinning.test.ts`.
 */
export * from "./schemas.js";
export {
  createLearningClient,
  LearningClientError,
  type LearningClient,
  type LearningClientOptions,
} from "./client.js";
