import { Platform } from "react-native";

const TOKEN_KEY = "aivo_access_token";
const MUST_CHANGE_PASSWORD_KEY = "aivo_must_change_password";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module load on non-web platforms
  SecureStore = require("expo-secure-store");
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore!.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
    return;
  }
  await SecureStore!.setItemAsync(TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
    } catch {}
    return;
  }
  await SecureStore!.deleteItemAsync(TOKEN_KEY);
  await SecureStore!.deleteItemAsync(MUST_CHANGE_PASSWORD_KEY);
}

/**
 * Persist the `mustChangePassword` flag returned by the identity-svc
 * login flows alongside the access token. Stored separately (rather than
 * derived from the JWT) because the JWT does not carry this claim.
 */
export async function setMustChangePassword(value: boolean): Promise<void> {
  const v = value ? "1" : "0";
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, v);
    } catch {}
    return;
  }
  await SecureStore!.setItemAsync(MUST_CHANGE_PASSWORD_KEY, v);
}

export async function getMustChangePassword(): Promise<boolean> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === "1";
    } catch {
      return false;
    }
  }
  const v = await SecureStore!.getItemAsync(MUST_CHANGE_PASSWORD_KEY);
  return v === "1";
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  /**
   * Internal: when true, `apiFetch` will NOT attempt the refresh-and-retry
   * dance on a 401. Used by callers that have already handled refresh
   * themselves (or by the refresh code path itself, should it ever route
   * through `apiFetch` in the future).
   */
  skipRefreshRetry?: boolean;
}

// Shared in-flight refresh promise so a burst of concurrent 401s only
// triggers a single POST /api/auth/refresh.
let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Identity-svc refresh flow. The refresh token lives in an HTTP-only cookie
 * set on login/google/verify-mfa; native fetch on iOS / Android automatically
 * persists and replays cookies, and on web `credentials: 'include'` carries
 * them through the Next.js rewrite proxy.
 *
 * Returns the new access token on success, or `null` if the refresh failed
 * (which means the caller should let the original 401 propagate to the auth
 * provider so it can route to the login screen).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  // Lazy import to avoid a circular dep with @/constants/api at module init.
  const { API } = await import("@/constants/api");
  inFlightRefresh = (async () => {
    try {
      const res = await fetch(`${API.IDENTITY}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        // Refresh failed — clear any stale local state so the next render
        // routes to login. We deliberately do NOT clear the refresh cookie
        // here; the server already invalidates it on auth failure.
        await clearTokens();
        return null;
      }
      const data = (await res.json().catch(() => ({}))) as {
        accessToken?: string;
        mustChangePassword?: boolean;
      };
      if (!data.accessToken) {
        await clearTokens();
        return null;
      }
      await setToken(data.accessToken);
      // Mirror the login/verify-mfa flows — keep the SecureStore-backed
      // mustChangePassword flag in sync with the latest server response.
      if (typeof data.mustChangePassword === "boolean") {
        await setMustChangePassword(data.mustChangePassword);
      }
      return data.accessToken;
    } catch {
      return null;
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

export async function apiFetch(
  baseUrl: string,
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { skipAuth, skipRefreshRetry, ...fetchOptions } = options;
  const callerHeaders = (fetchOptions.headers as Record<string, string>) || {};
  const headers: Record<string, string> = { ...callerHeaders };

  // Only default to JSON when the request actually carries a body and the
  // caller hasn't already specified a content type. This avoids tagging
  // GETs with a misleading Content-Type and, more importantly, avoids
  // breaking multipart/form-data uploads (the boundary header would be
  // overwritten by `application/json`).
  const hasBody = fetchOptions.body != null;
  const hasContentTypeHeader = Object.keys(callerHeaders).some(
    (k) => k.toLowerCase() === "content-type",
  );
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  if (hasBody && !hasContentTypeHeader && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const url = `${baseUrl}${path}`;
  const response = await fetch(url, { ...fetchOptions, headers });

  // Auto-retry on 401: the access token likely expired (identity-svc signs
  // short-lived JWTs and the refresh cookie is good for much longer). Try
  // to silently refresh once, then replay the original request with the
  // new bearer. If we already retried (or the caller opted out of auth),
  // surface the 401 as-is.
  if (response.status === 401 && !skipAuth && !skipRefreshRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders: Record<string, string> = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };
      return fetch(url, { ...fetchOptions, headers: retryHeaders });
    }
  }

  return response;
}

export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
