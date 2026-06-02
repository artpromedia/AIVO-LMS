/**
 * Client helper for step-up (MFA re-authentication) challenges.
 *
 * The backend (`identity-svc` `requireStepUp` / `requireRecentMfa`) responds
 * to a privileged request that lacks a recent second factor with HTTP 401
 * and a `WWW-Authenticate: StepUp` header (see ADR 0030). This helper wraps
 * `fetch` so any such response transparently routes the user to the step-up
 * challenge UI, preserving where they were headed via a `return` param.
 */

const STEP_UP_PATH = "/mfa/step-up";

/** Does this response demand a step-up challenge? */
export function isStepUpChallenge(res: Response): boolean {
  if (res.status !== 401) return false;
  const header = res.headers.get("www-authenticate") || "";
  return header.toLowerCase().includes("stepup");
}

/** Build the step-up URL that returns to `returnTo` after success. */
export function stepUpUrl(returnTo: string): string {
  return `${STEP_UP_PATH}?return=${encodeURIComponent(returnTo)}`;
}

/** Redirect the browser to the step-up challenge, remembering the return target. */
export function redirectToStepUp(returnTo: string = window.location.pathname): void {
  window.location.assign(stepUpUrl(returnTo));
}

/**
 * `fetch` wrapper that intercepts step-up challenges. On a `StepUp` 401 it
 * routes to the challenge UI and never resolves (the navigation supersedes
 * the caller). All other responses are returned untouched.
 */
export async function fetchWithStepUp(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (isStepUpChallenge(res)) {
    redirectToStepUp();
    // Surface a never-resolving promise so callers don't act on the 401;
    // the page is already navigating away to the challenge.
    return new Promise<Response>(() => {});
  }
  return res;
}
