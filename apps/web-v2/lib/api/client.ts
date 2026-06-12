/**
 * bffFetch — the one sanctioned client-side transport for /api/bff routes.
 *
 * Every BFF response uses the lib/bff/response envelope; this client parses
 * it exactly once, repo-wide:
 *   - 2xx + ok:true   → resolves with `data`
 *   - ok:false        → throws BffError carrying the server's `code`,
 *                       parent/learner-safe `userMessage` and `retryable`
 *   - network failure → throws BffError{ code: "NETWORK", retryable: true }
 *
 * Client components reach the BFF through this module (directly or via
 * TanStack Query mutations/queries) — never through bare `fetch`, which
 * returns `{}` on error and taught the codebase to swallow failures.
 * Enforced by scripts/ci/check-bare-fetch.mjs and an eslint rule.
 *
 * Decision note: @aivo/api-client's `/react` entry ships service-host hooks
 * (learning-svc et al), not a BFF envelope client — wrapping it would mean
 * re-implementing this envelope anyway, so the BFF client lives here beside
 * the envelope's own types.
 */
import type { BffFailure } from "@/lib/bff/response";

export class BffError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly requestId: string | null;

  constructor(input: {
    code: string;
    message: string;
    userMessage: string;
    retryable: boolean;
    status: number;
    requestId?: string | null;
  }) {
    super(input.message);
    this.name = "BffError";
    this.code = input.code;
    this.userMessage = input.userMessage;
    this.retryable = input.retryable;
    this.status = input.status;
    this.requestId = input.requestId ?? null;
  }
}

export function isBffError(e: unknown): e is BffError {
  return e instanceof BffError;
}

/** True when the failure was transport-level (offline, DNS, abort). */
export function isNetworkError(e: unknown): boolean {
  return isBffError(e) && e.code === "NETWORK";
}

export interface BffFetchInit extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Sent as the Idempotency-Key header (outbox replays stay single-shot). */
  idempotencyKey?: string;
}

export async function bffFetch<T>(path: string, init: BffFetchInit = {}): Promise<T> {
  const { body, idempotencyKey, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        ...(headers ?? {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    throw new BffError({
      code: "NETWORK",
      message: cause instanceof Error ? cause.message : "network request failed",
      userMessage: "We couldn't reach AIVO just now.",
      retryable: true,
      status: 0,
    });
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON body (proxy error page, empty 204). Fall through to the
    // status check with a synthesized envelope below.
  }

  const envelope = payload as { ok?: boolean } | null;
  if (envelope && envelope.ok === true) {
    return (envelope as { data: T }).data;
  }
  if (envelope && envelope.ok === false) {
    const failure = envelope as BffFailure;
    throw new BffError({
      code: failure.error.code,
      message: failure.error.message,
      userMessage: failure.error.userMessage,
      retryable: failure.error.retryable,
      status: res.status,
      requestId: failure.requestId,
    });
  }
  if (res.ok) {
    // 2xx without the envelope (non-BFF JSON route reached through this
    // client) — return the payload as-is so callers stay typed.
    return payload as T;
  }
  throw new BffError({
    code: `HTTP_${res.status}`,
    message: `request failed with status ${res.status}`,
    userMessage: "Something didn't load. Please try again.",
    retryable: res.status >= 500 || res.status === 429,
    status: res.status,
  });
}
