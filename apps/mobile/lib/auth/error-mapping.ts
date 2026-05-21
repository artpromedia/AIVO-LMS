/**
 * Centralized user-facing copy for identity-svc error responses.
 *
 * identity-svc returns responses shaped roughly like:
 *   200 OK         → { accessToken, mustChangePassword?, mfaPending?, … }
 *   400 Bad Req    → { error: "<msg>", reasons?: ["too_short", …], message?: "…" }
 *   401            → { error: "<msg>" }                  (invalid creds, expired token)
 *   403            → { error: "<msg>", lockedUntil?: <ms>, requiresMfaEnrollment?: bool }
 *   404            → { error: "<msg>" }
 *   409            → { error: "<msg>" }                  (already registered, e.g.)
 *   429            → { error: "<msg>", retryAfter?: <seconds> }
 *   5xx            → may not be JSON at all
 *
 * This module lifts the shape into a single typed surface so screens
 * don't each invent their own `data.error || data.message || "Network
 * error"` chain. Returns a user-readable string and a stable `code`
 * the caller can use for branching (e.g. "show MFA setup needed",
 * "redirect to login", "show retry timer").
 */

export type IdentityErrorCode =
  | "invalid_credentials"
  | "account_deactivated"
  | "account_locked"
  | "mfa_required"
  | "mfa_invalid"
  | "mfa_expired"
  | "email_already_registered"
  | "weak_password"
  | "rate_limited"
  | "session_expired"
  | "google_token_invalid"
  | "google_account_mismatch"
  | "requires_consent"
  | "validation_failed"
  | "network_error"
  | "server_error"
  | "unknown";

export type IdentityErrorResult = {
  code: IdentityErrorCode;
  /** Localized user-facing copy, ready to surface in a toast / banner. */
  message: string;
  /** Optional structured detail for callers that want to render policy hints. */
  reasons?: string[];
  /** Optional retry-after window in seconds for 429s. */
  retryAfterSeconds?: number;
  /** Pass-through HTTP status if available. */
  status?: number;
};

type IdentityErrorBody = {
  error?: string;
  message?: string;
  reasons?: string[];
  retryAfter?: number;
  lockedUntil?: number;
  requiresConsent?: boolean;
};

/**
 * Map an identity-svc fetch Response (already known to be !ok) to a
 * `{code, message, …}` shape. Reads the body once.
 */
export async function mapIdentityErrorResponse(
  response: Response,
  fallback?: string,
): Promise<IdentityErrorResult> {
  let body: IdentityErrorBody = {};
  try {
    body = (await response.json()) as IdentityErrorBody;
  } catch {
    /* not JSON */
  }
  return mapIdentityErrorBody(response.status, body, fallback);
}

/**
 * Map a pre-parsed identity-svc error body to a normalized result.
 * Useful when the calling code has already read `response.json()`.
 */
export function mapIdentityErrorBody(
  status: number,
  body: IdentityErrorBody | null | undefined,
  fallback?: string,
): IdentityErrorResult {
  const raw = (body?.error || body?.message || "").trim();
  const lower = raw.toLowerCase();

  // 429: rate-limited. retryAfter is sometimes a seconds number from
  // the API; we surface it so the UI can render a countdown.
  if (status === 429) {
    return {
      code: "rate_limited",
      message:
        raw ||
        "Too many attempts. Please wait a moment and try again.",
      retryAfterSeconds: body?.retryAfter,
      status,
    };
  }

  // 409: conflict — almost always "email already registered".
  if (status === 409) {
    if (lower.includes("already")) {
      return {
        code: "email_already_registered",
        message: "An account with that email already exists.",
        status,
      };
    }
    return { code: "validation_failed", message: raw || "Conflict.", status };
  }

  // 400: validation / password policy. `reasons` carries policy codes
  // like "too_short", "too_weak", "breached", "reused", "missing_diversity".
  if (status === 400) {
    if (body?.reasons && body.reasons.length > 0) {
      return {
        code: "weak_password",
        message:
          raw ||
          "Your password doesn't meet the security policy. Try a longer or more unique passphrase.",
        reasons: body.reasons,
        status,
      };
    }
    if (body?.requiresConsent) {
      return {
        code: "requires_consent",
        message:
          raw ||
          "Please confirm parental consent and terms before continuing.",
        status,
      };
    }
    return {
      code: "validation_failed",
      message: raw || "Please check the form and try again.",
      status,
    };
  }

  // 403: deactivated, locked, or MFA-required-but-not-enrolled.
  if (status === 403) {
    if (lower.includes("deactivat")) {
      return {
        code: "account_deactivated",
        message:
          raw || "Your account has been deactivated. Contact support.",
        status,
      };
    }
    if (lower.includes("lock") || body?.lockedUntil) {
      return {
        code: "account_locked",
        message:
          raw ||
          "Your account is temporarily locked after too many failed attempts. Try again later.",
        status,
      };
    }
    return {
      code: "mfa_required",
      message:
        raw || "Additional verification is required to continue.",
      status,
    };
  }

  // 401: invalid credentials / expired MFA token / generic auth error.
  if (status === 401) {
    if (lower.includes("mfa") && lower.includes("expir")) {
      return {
        code: "mfa_expired",
        message: "Your verification code expired. Sign in again.",
        status,
      };
    }
    if (lower.includes("mfa") || lower.includes("code")) {
      return {
        code: "mfa_invalid",
        message: raw || "That code didn't match. Try again.",
        status,
      };
    }
    if (lower.includes("google")) {
      return {
        code: "google_token_invalid",
        message: raw || "Couldn't verify your Google sign-in. Try again.",
        status,
      };
    }
    return {
      code: "invalid_credentials",
      message: raw || "Incorrect email or password.",
      status,
    };
  }

  // 5xx: server side blew up.
  if (status >= 500) {
    return {
      code: "server_error",
      message:
        raw ||
        "Something went wrong on our end. Please try again in a moment.",
      status,
    };
  }

  return {
    code: "unknown",
    message: raw || fallback || "Something went wrong. Please try again.",
    status,
  };
}

/**
 * Wrap a fetch-throwing block. Use in screens to convert network
 * exceptions into the same normalized shape as HTTP errors:
 *
 *   try { ... } catch (err) { return { ...mapIdentityNetworkError(err) } }
 */
export function mapIdentityNetworkError(_err: unknown): IdentityErrorResult {
  return {
    code: "network_error",
    message:
      "Couldn't reach the server. Check your connection and try again.",
  };
}

/**
 * Translate a password-policy `reasons[]` entry to user copy. Mirrors
 * the mapping used on the web-v2 reset-password screen so password
 * change/reset/register surfaces all read consistently.
 */
export function describePasswordReason(reason: string): string {
  switch (reason) {
    case "too_short":
      return "Use at least 12 characters.";
    case "too_weak":
      return "Try a longer or more unique passphrase.";
    case "breached":
      return "This password has appeared in a data breach. Pick a different one.";
    case "reused":
      return "You've used this password before. Pick a new one.";
    case "missing_diversity":
      return "Mix letters, numbers, and symbols.";
    default:
      return reason;
  }
}
