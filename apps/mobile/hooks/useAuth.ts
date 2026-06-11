import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  getToken,
  setToken,
  clearTokens,
  decodeJWT,
  apiFetch,
  setMustChangePassword as persistMustChangePassword,
  getMustChangePassword,
} from "@/lib/api";
import { setApiActiveRole } from "@/lib/active-role";
import { tryBiometricUnlock, disableBiometricUnlock } from "@/lib/biometric";
import {
  mapIdentityErrorResponse,
  mapIdentityErrorBody,
  mapIdentityNetworkError,
} from "@/lib/auth/error-mapping";
import { API } from "@/constants/api";
import type { UserRole } from "@aivo/brand";
import { registerPushToken, unregisterPushToken } from "@/lib/notifications";

interface User {
  id: string;
  email?: string;
  name: string;
  role: UserRole;
  /**
   * Every role the user may act as (ADR 0020 — multi-role). Decoded from the
   * JWT's `availableRoles` claim; defaults to `[role]`. The unified shell's
   * RoleProvider sources its switchable roles from this.
   */
  availableRoles: UserRole[];
  tenantId: string;
  /**
   * Optional profile-photo URL. Not part of the JWT payload; populated
   * by callers (e.g. `AccountSettingsCard`) after the user uploads or
   * removes their avatar via identity-svc.
   */
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    mfaPending?: boolean;
    mfaToken?: string;
    mustChangePassword?: boolean;
  }>;
  loginWithPin: (pin: string, parentId: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (
    idToken: string,
    consent?: { coppaConsent: boolean; termsAccepted: boolean },
  ) => Promise<{
    success: boolean;
    error?: string;
    requiresConsent?: boolean;
    mfaPending?: boolean;
    mfaToken?: string;
    mustChangePassword?: boolean;
  }>;
  verifyMfa: (
    mfaToken: string,
    code: string,
  ) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  resendMfa: (mfaToken: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * Hand a SecureStore-gated access token back to the auth context
   * after the user satisfies a biometric prompt. The token may already
   * be near-expiry; `apiFetch` will refresh-and-retry on the next 401.
   */
  unlockWithBiometric: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  clearMustChangePassword: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  name: string;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useAuthState(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    mustChangePassword: false,
  });

  const extractUser = (token: string): User | null => {
    const payload = decodeJWT(token);
    if (!payload) return null;
    const role = payload.role as UserRole;
    const claimed = Array.isArray(payload.availableRoles)
      ? (payload.availableRoles as UserRole[]).filter(Boolean)
      : [];
    const availableRoles = claimed.length > 0 ? claimed : [role];
    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      name: (payload.name as string) || "",
      role,
      availableRoles,
      tenantId: (payload.tenantId as string) || "",
    };
  };

  // Keep the active-role hint (sent on every authenticated request by
  // lib/api.ts) in sync with the signed-in user. Single-role today; the
  // unified shell's role switcher updates it on switch. Cleared on logout.
  useEffect(() => {
    setApiActiveRole(state.user?.role ?? null);
  }, [state.user?.role]);

  const checkAuth = useCallback(async () => {
    const token = await getToken();
    if (token) {
      const payload = decodeJWT(token);
      if (payload?.exp) {
        const expiresAt = (payload.exp as number) * 1000;
        if (Date.now() < expiresAt) {
          const user = extractUser(token);
          if (user) {
            const mustChange = await getMustChangePassword();
            setState({
              user,
              isLoading: false,
              isAuthenticated: true,
              mustChangePassword: mustChange,
            });
            return;
          }
        }
      }
    }
    setState({ user: null, isLoading: false, isAuthenticated: false, mustChangePassword: false });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        checkAuth();
      }
    });
    return () => sub.remove();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        if (data.mfaPending) {
          return { success: false, mfaPending: true, mfaToken: data.mfaToken };
        }
        await setToken(data.accessToken);
        const mustChange = !!data.mustChangePassword;
        await persistMustChangePassword(mustChange);
        const user = extractUser(data.accessToken);
        if (user) {
          setState({
            user,
            isLoading: false,
            isAuthenticated: true,
            mustChangePassword: mustChange,
          });
          // Fire-and-forget: device token registration must never gate login.
          void registerPushToken();
          return { success: true, mustChangePassword: mustChange };
        }
      }
      const mapped = mapIdentityErrorBody(response.status, data);
      return { success: false, error: mapped.message };
    } catch (err) {
      return { success: false, error: mapIdentityNetworkError(err).message };
    }
  }, []);

  const loginWithPin = useCallback(async (pin: string, parentId: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, "/api/auth/pin-login", {
        method: "POST",
        body: JSON.stringify({ parentId, pin }),
        skipAuth: true,
      });

      if (response.ok) {
        const data = await response.json();
        await setToken(data.accessToken);
        // Learners (PIN flow) are never subject to forced password rotation.
        await persistMustChangePassword(false);
        const user = extractUser(data.accessToken);
        if (user) {
          setState({ user, isLoading: false, isAuthenticated: true, mustChangePassword: false });
          return { success: true };
        }
      }
      const mapped = await mapIdentityErrorResponse(response, "Incorrect PIN");
      return { success: false, error: mapped.message };
    } catch (err) {
      return { success: false, error: mapIdentityNetworkError(err).message };
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    try {
      const response = await apiFetch(API.IDENTITY, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          role: "PARENT",
        }),
        skipAuth: true,
      });

      if (response.ok) {
        const result = await response.json();
        await setToken(result.accessToken);
        // A user who just chose their own password isn't being forced to
        // change it again. The register endpoint also does not return the
        // flag, so default to false.
        await persistMustChangePassword(false);
        const user = extractUser(result.accessToken);
        if (user) {
          setState({ user, isLoading: false, isAuthenticated: true, mustChangePassword: false });
          return { success: true };
        }
      }
      const error = await response.json().catch(() => ({}));
      const mapped = mapIdentityErrorBody(response.status, error);
      return { success: false, error: mapped.message };
    } catch (err) {
      return { success: false, error: mapIdentityNetworkError(err).message };
    }
  }, []);

  const loginWithGoogle = useCallback(
    async (idToken: string, consent?: { coppaConsent: boolean; termsAccepted: boolean }) => {
      try {
        const body: Record<string, unknown> = { idToken };
        if (consent) {
          body.coppaConsent = consent.coppaConsent;
          body.termsAccepted = consent.termsAccepted;
        }

        const response = await apiFetch(API.IDENTITY, "/api/auth/google", {
          method: "POST",
          body: JSON.stringify(body),
          skipAuth: true,
        });

        const data = await response.json();
        if (response.ok) {
          if (data.mfaPending) {
            return { success: false, mfaPending: true, mfaToken: data.mfaToken };
          }
          await setToken(data.accessToken);
          const mustChange = !!data.mustChangePassword;
          await persistMustChangePassword(mustChange);
          const user = extractUser(data.accessToken);
          if (user) {
            setState({
              user,
              isLoading: false,
              isAuthenticated: true,
              mustChangePassword: mustChange,
            });
            return { success: true, mustChangePassword: mustChange };
          }
        }
        if (data.requiresConsent) {
          return { success: false, error: "requiresConsent", requiresConsent: true };
        }
        const mapped = mapIdentityErrorBody(response.status, data);
        return { success: false, error: mapped.message };
      } catch (err) {
        return { success: false, error: mapIdentityNetworkError(err).message };
      }
    },
    [],
  );

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, "/api/auth/verify-mfa", {
        method: "POST",
        body: JSON.stringify({ mfaToken, code }),
        skipAuth: true,
      });
      if (response.ok) {
        const data = await response.json();
        await setToken(data.accessToken);
        const mustChange = !!data.mustChangePassword;
        await persistMustChangePassword(mustChange);
        const user = extractUser(data.accessToken);
        if (user) {
          setState({
            user,
            isLoading: false,
            isAuthenticated: true,
            mustChangePassword: mustChange,
          });
          return { success: true, mustChangePassword: mustChange };
        }
      }
      const error = await response.json().catch(() => ({}));
      const mapped = mapIdentityErrorBody(response.status, error, "Verification failed");
      return { success: false, error: mapped.message };
    } catch (err) {
      return { success: false, error: mapIdentityNetworkError(err).message };
    }
  }, []);

  const resendMfa = useCallback(async (mfaToken: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, "/api/auth/mfa/resend", {
        method: "POST",
        body: JSON.stringify({ mfaToken }),
        skipAuth: true,
      });
      if (response.ok) {
        return { success: true };
      }
      const error = await response.json().catch(() => ({}));
      const mapped = mapIdentityErrorBody(response.status, error, "Resend failed");
      return { success: false, error: mapped.message };
    } catch (err) {
      return { success: false, error: mapIdentityNetworkError(err).message };
    }
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const token = await tryBiometricUnlock();
    if (!token) {
      return { success: false, error: "biometric_failed" };
    }
    const payload = decodeJWT(token);
    if (!payload) {
      // Token is unreadable: scrap the biometric copy so the user falls
      // back to password next time instead of looping on a bad unlock.
      await disableBiometricUnlock();
      return { success: false, error: "biometric_token_invalid" };
    }
    await setToken(token);
    const user = extractUser(token);
    const mustChange = await getMustChangePassword();
    if (!user) {
      await disableBiometricUnlock();
      return { success: false, error: "biometric_token_invalid" };
    }
    setState({
      user,
      isLoading: false,
      isAuthenticated: true,
      mustChangePassword: mustChange,
    });
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    // Revoke this device's push token BEFORE the access token is cleared —
    // the DELETE is authenticated (Sprint A6).
    await unregisterPushToken();
    try {
      await apiFetch(API.IDENTITY, "/api/auth/logout", { method: "POST" });
    } catch {
      /* network failures shouldn't block local sign-out */
    }
    // Wipe biometric opt-in too: a logged-out user must not be able to
    // unlock back into the previous session via Face ID. Settings can
    // re-enable after the next successful login.
    await disableBiometricUnlock();
    await clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false, mustChangePassword: false });
  }, []);

  const clearMustChangePassword = useCallback(async () => {
    await persistMustChangePassword(false);
    setState((prev) => ({ ...prev, mustChangePassword: false }));
  }, []);

  return {
    ...state,
    login,
    loginWithPin,
    signup,
    loginWithGoogle,
    verifyMfa,
    resendMfa,
    unlockWithBiometric,
    logout,
    clearMustChangePassword,
  };
}
