"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import Image from "next/image";

const DISTRICT_ROLES = ["DISTRICT_ADMIN", "PLATFORM_ADMIN"];

interface DiscoverResult {
  mode: "password" | "sso";
  ssoLoginUrl?: string;
  idpLabel?: string;
  requireSso?: boolean;
}

export default function DistrictLoginPage() {
  const { user, loading: authLoading, refreshToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [discover, setDiscover] = useState<DiscoverResult | null>(null);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    if (!authLoading && user && DISTRICT_ROLES.includes(user.role)) {
      router.push("/dashboard/district");
    }
  }, [user, authLoading, router]);

  // Sprint 6: home-realm discovery. As soon as the user finishes typing
  // a plausible email we ask the server whether their domain is wired up
  // for SAML SSO. Debounce so we're not flooding /discover on every keystroke.
  useEffect(() => {
    if (!email.includes("@") || email.length < 5) {
      setDiscover(null);
      return;
    }
    const handle = setTimeout(async () => {
      setDiscovering(true);
      try {
        const res = await fetch("/api/auth/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) setDiscover(await res.json());
        else setDiscover(null);
      } catch {
        setDiscover(null);
      }
      setDiscovering(false);
    }, 400);
    return () => clearTimeout(handle);
  }, [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/district-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      if (data.mfaPending) {
        router.push(
          `/verify-mfa?token=${encodeURIComponent(data.mfaToken)}&method=${encodeURIComponent(data.mfaMethod || "email")}&returnTo=/dashboard/district`,
        );
        return;
      }
      await refreshToken();
      router.push("/dashboard/district");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
    setLoading(false);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-indigo-950 via-violet-900 to-indigo-950">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-sky-500 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-fuchsia-500 rounded-full blur-3xl" />
        </div>

        <div className="absolute inset-0 flex flex-col justify-between p-12 z-10">
          <div className="flex items-center gap-3">
            <Image
              src="/images/aivo-logo-white.png"
              alt="AIVO"
              width={120}
              height={38}
              style={{ width: "auto", height: "auto" }}
            />
            <div className="h-6 w-px bg-white/30" />
            <span className="text-sm font-bold text-violet-300 uppercase tracking-widest">
              District
            </span>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-heading font-bold text-white leading-tight">
                District
                <br />
                Administration
              </h2>
              <p className="text-base text-white/60 font-body mt-4 max-w-sm leading-relaxed">
                Manage schools, classrooms, staff, and learners across your district. Monitor usage,
                integrations, and IEP workflows.
              </p>
            </div>

            <div className="flex items-center gap-4 text-white/40">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span className="text-xs font-medium">FERPA &amp; COPPA compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span className="text-xs font-medium">Audit logged</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-white/30">
            <svg className="w-4 h-4 text-emerald-400/60" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" />
            </svg>
            <span>district.aivolearning.com</span>
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col bg-violet-50/40 min-h-screen">
        <div className="flex items-center justify-between p-6 lg:p-8">
          <div className="lg:hidden flex items-center gap-2">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO"
              width={90}
              height={28}
              style={{ width: "auto", height: "auto" }}
            />
            <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">
              District
            </span>
          </div>
          <div className="lg:ml-auto" />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-700 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-violet-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-heading font-bold text-slate-900">
                    District Sign In
                  </h1>
                  <p className="text-sm text-slate-500 font-body">District administrators only</p>
                </div>
              </div>
            </div>

            {error && (
              <div
                className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium mb-6"
                role="alert"
              >
                <svg
                  className="w-5 h-5 text-red-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="district-email"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Work Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg
                      className="w-5 h-5 text-violet-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <input
                    id="district-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border border-violet-200 text-slate-900 placeholder-slate-400 focus:border-violet-700 focus:ring-2 focus:ring-violet-700/15 outline-none transition font-body"
                    placeholder="admin@yourdistrict.org"
                  />
                </div>
              </div>

              {discover?.mode === "sso" && discover.ssoLoginUrl && (
                <a
                  href={discover.ssoLoginUrl}
                  className="block w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold text-base text-center hover:bg-slate-800 active:bg-slate-700 transition-all shadow-lg"
                >
                  Continue with {discover.idpLabel || "your identity provider"}
                </a>
              )}
              {discover?.mode === "sso" && discover.requireSso && (
                <p className="text-xs text-slate-500 text-center">
                  Your district requires SSO — password sign-in is disabled for this email domain.
                </p>
              )}

              {!(discover?.mode === "sso" && discover.requireSso) && (
                <div>
                  <label
                    htmlFor="district-password"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-violet-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                    <input
                      id="district-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white border border-violet-200 text-slate-900 placeholder-slate-400 focus:border-violet-700 focus:ring-2 focus:ring-violet-700/15 outline-none transition font-body"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.879L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading || discovering || (discover?.mode === "sso" && !!discover.requireSso)
                }
                className="w-full py-3.5 rounded-xl bg-violet-700 text-white font-bold text-base hover:bg-violet-800 active:bg-violet-900 transition-all shadow-lg shadow-violet-900/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  "Sign In to District Console"
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-violet-200">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>All sign-in attempts are logged and monitored</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 pb-6 text-xs text-slate-400 font-body">
          <span>&copy; {new Date().getFullYear()} AIVO Learning Platform</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>District v1.0</span>
        </div>
      </main>
    </div>
  );
}
