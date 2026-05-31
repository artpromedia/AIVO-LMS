/**
 * Centralized error code catalog so every BFF route emits a consistent
 * `{ code, userMessage, retryable, status }` shape. Add new codes here rather
 * than at the call site so the client error mapper stays exhaustive.
 */
export const ERRORS = {
  UNAUTHENTICATED: {
    code: "UNAUTHENTICATED",
    userMessage: "Please sign in to continue.",
    retryable: false,
    status: 401,
  },
  FORBIDDEN_ROLE: {
    code: "FORBIDDEN_ROLE",
    userMessage: "You don't have access to that area.",
    retryable: false,
    status: 403,
  },
  FORBIDDEN_TENANT: {
    code: "FORBIDDEN_TENANT",
    userMessage: "You don't have access to that resource.",
    retryable: false,
    status: 403,
  },
  FORBIDDEN_LEARNER: {
    code: "FORBIDDEN_LEARNER",
    userMessage: "You don't have access to that learner.",
    retryable: false,
    status: 403,
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    userMessage: "We couldn't find what you were looking for.",
    retryable: false,
    status: 404,
  },
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    userMessage: "Some details look off. Check the form and try again.",
    retryable: false,
    status: 400,
  },
  CONFLICT: {
    code: "CONFLICT",
    userMessage: "That change conflicts with something we already have.",
    retryable: false,
    status: 409,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    userMessage: "Too many requests. Please wait a moment.",
    retryable: true,
    status: 429,
  },
  UPSTREAM_UNAVAILABLE: {
    code: "UPSTREAM_UNAVAILABLE",
    userMessage: "A helper service is taking a break. Please try again shortly.",
    retryable: true,
    status: 502,
  },
  PRECONDITION_FAILED: {
    code: "PRECONDITION_FAILED",
    userMessage: "We're missing an earlier step. Please go back and complete it first.",
    retryable: false,
    status: 412,
  },
  STEP_UP_REQUIRED: {
    code: "STEP_UP_REQUIRED",
    userMessage: "Please verify it's you to switch into that role.",
    retryable: false,
    status: 403,
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    userMessage: "Something went wrong. Please try again in a moment.",
    retryable: true,
    status: 500,
  },
} as const;

export type ErrorCode = keyof typeof ERRORS;
