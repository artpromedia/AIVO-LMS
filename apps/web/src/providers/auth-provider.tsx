"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithStepUp } from "@/lib/step-up";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  isImpersonating: boolean;
  originalAdmin: User | null;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  pinLogin: (parentId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  applySession: (data: { user: User; accessToken: string; mustChangePassword?: boolean }) => void;
  impersonate: (userId: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

const IMPERSONATION_FLAG_KEY = "aivo_impersonating";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdmin, setOriginalAdmin] = useState<User | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
        // Sprint 7: surface the gate so the SPA can route the user to the
        // forced change-password screen before letting them touch anything
        // else.
        setMustChangePassword(!!data.mustChangePassword);
        const meRes = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setUser(meData);

          const flag = sessionStorage.getItem(IMPERSONATION_FLAG_KEY);
          if (flag) {
            setIsImpersonating(false);
            setOriginalAdmin(null);
            sessionStorage.removeItem(IMPERSONATION_FLAG_KEY);
          }
        }
        setLoading(false);
        return data.accessToken as string;
      }
    } catch {}
    setLoading(false);
    return null;
  }, []);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  // flushSync so the dashboard layout sees `user` on its first render after
  // router.push — without it the !user guard races and bounces back to login.
  const applySession = useCallback(
    (data: { user: User; accessToken: string; mustChangePassword?: boolean }) => {
      flushSync(() => {
        setUser(data.user);
        setAccessToken(data.accessToken);
        setMustChangePassword(!!data.mustChangePassword);
        setIsImpersonating(false);
        setOriginalAdmin(null);
        setLoading(false);
      });
      sessionStorage.removeItem(IMPERSONATION_FLAG_KEY);
    },
    [],
  );

  // Sprint 7: enforce mustChangePassword by redirecting to the change-
  // password page from anywhere in the dashboard. We allow the user to
  // hit /dashboard/change-password itself and the auth pages so they can
  // actually complete the change.
  useEffect(() => {
    if (loading || !user || !mustChangePassword) return;
    const allowed = [
      "/dashboard/change-password",
      "/login",
      "/district/login",
      "/admin/login",
      "/logout",
    ];
    if (allowed.some((p) => pathname?.startsWith(p))) return;
    router.push("/dashboard/change-password");
  }, [loading, user, mustChangePassword, pathname, router]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || "Login failed") as Error & {
        redirectTo?: string;
        wrongSurface?: string;
      };
      if (data.redirectTo) err.redirectTo = data.redirectTo;
      if (data.wrongSurface) err.wrongSurface = data.wrongSurface;
      throw err;
    }
    if (data.mfaPending) {
      return { mfaPending: true, mfaToken: data.mfaToken, mfaMethod: data.mfaMethod };
    }
    setUser(data.user);
    setAccessToken(data.accessToken);
    setIsImpersonating(false);
    setOriginalAdmin(null);
    sessionStorage.removeItem(IMPERSONATION_FLAG_KEY);
    return data;
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role }),
      credentials: "include",
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    setUser(data.user);
    setAccessToken(data.accessToken);
  };

  const pinLogin = async (parentId: string, pin: string) => {
    const res = await fetch("/api/auth/pin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, pin }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    setUser(data.user);
    setAccessToken(data.accessToken);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setAccessToken(null);
    setIsImpersonating(false);
    setOriginalAdmin(null);
    sessionStorage.removeItem(IMPERSONATION_FLAG_KEY);
  };

  const impersonate = async (userId: string) => {
    if (!accessToken || !user) throw new Error("Not authenticated");
    if (user.role !== "PLATFORM_ADMIN") throw new Error("Not authorized");

    const res = await fetchWithStepUp("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
      accessToken,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Impersonation failed");
    }
    const data = await res.json();

    setOriginalAdmin({ ...user });
    sessionStorage.setItem(IMPERSONATION_FLAG_KEY, "true");
    setIsImpersonating(true);
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const exitImpersonation = async () => {
    // Sprint 4: explicit end-of-impersonation hop so we get an
    // IMPERSONATION_ENDED audit row with duration, plus a fresh admin
    // access token for the original admin without forcing re-login.
    if (accessToken) {
      try {
        const res = await fetch("/api/admin/impersonate/end", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setAccessToken(data.accessToken);
          setIsImpersonating(false);
          setOriginalAdmin(null);
          sessionStorage.removeItem(IMPERSONATION_FLAG_KEY);
          return;
        }
      } catch {}
    }
    // Fallback: clear local state and refresh from cookie session.
    sessionStorage.removeItem(IMPERSONATION_FLAG_KEY);
    setIsImpersonating(false);
    setOriginalAdmin(null);
    await refreshToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        isImpersonating,
        originalAdmin,
        login,
        register,
        pinLogin,
        logout,
        refreshToken,
        applySession,
        impersonate,
        exitImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
