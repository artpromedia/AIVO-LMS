/**
 * Service registry — single import point for all upstream service
 * clients. Per ADR 0009, BFF handlers + repos call these instead of
 * reaching into `fetch` directly, so failure handling, timeouts,
 * retries, and the dev-fallback pattern are uniform.
 *
 * Each client decides whether to hit the real upstream or fall back to
 * the in-memory implementation based on AIVO_USE_<SERVICE> /
 * AIVO_USE_SERVICE_STACK. Callers don't branch.
 */
export * as brainSvc from "./brain-svc";
export { callService } from "./client";
export type {
  ServiceCallOptions,
  ServiceCallResult,
  ServiceCallSuccess,
  ServiceCallFailure,
} from "./client";
