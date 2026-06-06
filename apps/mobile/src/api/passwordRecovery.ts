/**
 * Account recovery client — mobile mirror of web's
 * `apps/web-v2/app/onboarding/recovery`.
 *
 * Hits identity-svc's `POST /api/auth/forgot-password`, which always
 * returns a generic success ("if that email is registered, a reset link
 * has been sent") to avoid account enumeration. The request is
 * unauthenticated (`skipAuth`) because the user is, by definition, locked
 * out when they reach this screen.
 */
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface ForgotPasswordResult {
  ok?: boolean;
  message?: string;
}

/**
 * Pure fetcher (exported for unit tests). Resolves on a 2xx response and
 * throws on anything else so the screen surfaces a real error state.
 */
export async function requestPasswordReset(email: string): Promise<ForgotPasswordResult> {
  const res = await apiFetch(API.IDENTITY, "/api/auth/forgot-password", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(data.error || data.message || "Couldn't send the reset link. Please try again.");
  }
  return (await res.json().catch(() => ({}))) as ForgotPasswordResult;
}
