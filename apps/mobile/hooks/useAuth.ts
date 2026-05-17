import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  getToken, setToken, clearTokens, decodeJWT, apiFetch,
  setMustChangePassword as persistMustChangePassword,
  getMustChangePassword,
} from '@/lib/api';
import { API } from '@/constants/api';
import type { UserRole } from '@aivo/brand';

interface User {
  id: string;
  email?: string;
  name: string;
  role: UserRole;
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; mfaPending?: boolean; mfaToken?: string; mustChangePassword?: boolean }>;
  loginWithPin: (pin: string, parentId: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (idToken: string, consent?: { coppaConsent: boolean; termsAccepted: boolean }) => Promise<{ success: boolean; error?: string; requiresConsent?: boolean; mfaPending?: boolean; mfaToken?: string; mustChangePassword?: boolean }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  resendMfa: (mfaToken: string) => Promise<{ success: boolean; error?: string }>;
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
    throw new Error('useAuth must be used within an AuthProvider');
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
    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      name: payload.name as string || '',
      role: payload.role as UserRole,
      tenantId: payload.tenantId as string || '',
    };
  };

  const checkAuth = useCallback(async () => {
    const token = await getToken();
    if (token) {
      const payload = decodeJWT(token);
      if (payload && payload.exp) {
        const expiresAt = (payload.exp as number) * 1000;
        if (Date.now() < expiresAt) {
          const user = extractUser(token);
          if (user) {
            const mustChange = await getMustChangePassword();
            setState({ user, isLoading: false, isAuthenticated: true, mustChangePassword: mustChange });
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
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkAuth();
      }
    });
    return () => sub.remove();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
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
          setState({ user, isLoading: false, isAuthenticated: true, mustChangePassword: mustChange });
          return { success: true, mustChangePassword: mustChange };
        }
      }
      return { success: false, error: data.error || data.message || 'Login failed' };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const loginWithPin = useCallback(async (pin: string, parentId: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, '/api/auth/pin-login', {
        method: 'POST',
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
      return { success: false, error: 'Incorrect PIN' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    try {
      const response = await apiFetch(API.IDENTITY, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, password: data.password, name: data.name, role: 'PARENT' }),
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
      return { success: false, error: error.error || error.message || 'Registration failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string, consent?: { coppaConsent: boolean; termsAccepted: boolean }) => {
    try {
      const body: Record<string, unknown> = { idToken };
      if (consent) {
        body.coppaConsent = consent.coppaConsent;
        body.termsAccepted = consent.termsAccepted;
      }

      const response = await apiFetch(API.IDENTITY, '/api/auth/google', {
        method: 'POST',
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
          setState({ user, isLoading: false, isAuthenticated: true, mustChangePassword: mustChange });
          return { success: true, mustChangePassword: mustChange };
        }
      }
      if (data.requiresConsent) {
        return { success: false, error: 'requiresConsent', requiresConsent: true };
      }
      return { success: false, error: data.error || 'Google sign-in failed' };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, '/api/auth/verify-mfa', {
        method: 'POST',
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
          setState({ user, isLoading: false, isAuthenticated: true, mustChangePassword: mustChange });
          return { success: true, mustChangePassword: mustChange };
        }
      }
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || 'Verification failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const resendMfa = useCallback(async (mfaToken: string) => {
    try {
      const response = await apiFetch(API.IDENTITY, '/api/auth/mfa/resend', {
        method: 'POST',
        body: JSON.stringify({ mfaToken }),
        skipAuth: true,
      });
      if (response.ok) {
        return { success: true };
      }
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error.error || 'Resend failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch(API.IDENTITY, '/api/auth/logout', { method: 'POST' });
    } catch {}
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
    logout,
    clearMustChangePassword,
  };
}
