/**
 * Email-verification client — mobile mirror of web's
 * `apps/web-v2/app/verify-email` flow and the `identityVerifyEmail` /
 * `identitySendVerificationEmail` helpers in
 * `apps/web-v2/lib/auth/identity-client.ts`.
 *
 * Both calls are unauthenticated (`skipAuth`): `verifyEmail` proves identity
 * via the one-time token from the email link, and `resendVerificationEmail`
 * runs before the address is confirmed. The resend endpoint always returns a
 * generic success (no account enumeration), same posture as forgot-password.
 */
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface VerifyEmailResult {
  ok?: boolean;
  email?: string | null;
}

/**
 * Redeem a verification token (single-use, 24h TTL). Resolves on a 2xx and
 * throws on anything else so the screen can surface an expired/used-link
 * state. Exported as a pure fetcher for unit tests.
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const res = await apiFetch(API.IDENTITY, "/api/auth/verify-email", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ token: token.trim() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "This confirmation link has expired or has already been used.");
  }
  return (await res.json().catch(() => ({}))) as VerifyEmailResult;
}

/**
 * Request a fresh verification link. The server answers generically, so a
 * 2xx only means "request accepted", never "address exists / is unverified".
 */
export async function resendVerificationEmail(email: string): Promise<{ ok?: boolean; message?: string }> {
  const res = await apiFetch(API.IDENTITY, "/api/auth/send-verification-email", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(data.error || data.message || "Couldn't send the link. Please try again.");
  }
  return (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
}
