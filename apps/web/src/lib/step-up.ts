"use client";
/**
 * Step-up auth client helper (Sprint 3).
 *
 * Provides a global `requireStepUp(scope)` function that opens the step-up
 * modal, runs the strongest available factor, and resolves with the
 * resulting `stepUpToken`. The token is then attached to the original
 * request via the `x-step-up-token` header.
 *
 * Usage:
 *   const res = await fetchWithStepUp("/api/admin/users/123", { method: "DELETE", accessToken });
 *
 * The helper performs the request, intercepts a 403 with
 * `{ code: "STEP_UP_REQUIRED", scope }`, runs the challenge, and retries.
 */

export type StepUpScope =
  | "tenant:delete"
  | "tenant:suspend"
  | "user:delete"
  | "user:impersonate"
  | "role:change"
  | "brain:reset"
  | "data:export"
  | "config:update"
  | "district:admin-mgmt";

type Resolver = (token: string) => void;
type Rejecter = (err: Error) => void;

interface Waiter {
  resolve: Resolver;
  reject: Rejecter;
}

interface PendingChallenge {
  scope: StepUpScope;
  accessToken: string;
  waiters: Waiter[];
}

type Listener = (pending: PendingChallenge | null) => void;

let current: PendingChallenge | null = null;
// FIFO queue of challenges waiting for the active one to settle. We keep
// scopes serialized through the modal because the user can only complete
// one factor at a time; same-scope requests in the queue are *coalesced*
// so the user only solves once even if many destructive ops fire at once.
const queue: PendingChallenge[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(current);
}

function pump() {
  if (current || queue.length === 0) return;
  current = queue.shift()!;
  notify();
}

export function subscribeStepUp(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function requireStepUp(scope: StepUpScope, accessToken: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const waiter: Waiter = { resolve, reject };
    // Coalesce same-scope requests onto the active challenge so the user
    // only solves the modal once. Different scopes are queued.
    if (current && current.scope === scope) {
      current.waiters.push(waiter);
      return;
    }
    const queued = queue.find((q) => q.scope === scope);
    if (queued) {
      queued.waiters.push(waiter);
      return;
    }
    queue.push({ scope, accessToken, waiters: [waiter] });
    pump();
  });
}

export function completeStepUp(token: string) {
  if (!current) return;
  const settled = current;
  current = null;
  notify();
  for (const w of settled.waiters) w.resolve(token);
  pump();
}

export function cancelStepUp(reason = "Cancelled") {
  if (!current) return;
  const settled = current;
  current = null;
  notify();
  const err = new Error(reason);
  for (const w of settled.waiters) w.reject(err);
  pump();
}

interface FetchOpts extends RequestInit {
  accessToken: string;
}

/**
 * fetch wrapper that transparently runs step-up when the server returns
 * 403 + `STEP_UP_REQUIRED`. Always sends `Authorization: Bearer <accessToken>`.
 */
export async function fetchWithStepUp(url: string, opts: FetchOpts): Promise<Response> {
  const { accessToken, headers, ...rest } = opts;
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...(headers as Record<string, string> | undefined),
  };
  let res = await fetch(url, { ...rest, headers: baseHeaders });
  if (res.status !== 403) return res;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return res;
  let body: any;
  try { body = await res.clone().json(); } catch { return res; }
  if (body?.code !== "STEP_UP_REQUIRED" || !body?.scope) return res;
  const stepUpToken = await requireStepUp(body.scope as StepUpScope, accessToken);
  res = await fetch(url, {
    ...rest,
    headers: { ...baseHeaders, "x-step-up-token": stepUpToken },
  });
  return res;
}
