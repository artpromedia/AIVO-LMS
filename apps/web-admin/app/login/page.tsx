import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { safeNextPath } from "@/lib/safe-redirect";
import { SsoHint } from "./sso-hint";
import { CloudMascot } from "./_components/cloud-mascot";
import {
  extractRefreshToken,
  identityAdminLogin,
  isAdminRole,
  MFA_CHALLENGE_COOKIE,
  MFA_CHALLENGE_MAX_AGE_SECONDS,
  requireAnonymous,
  ROLE_HOME,
  setAuthSessionCookies,
  toSessionProfile,
} from "@aivo/admin-auth";

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  missing_credentials: "Enter your email and password to sign in.",
  wrong_surface: "This account is not authorized for the admin console.",
  login_failed: "We could not sign you in. Please try again.",
  mfa_session_expired: "Your MFA challenge expired. Sign in again.",
};

async function signInAction(formData: FormData): Promise<void> {
  "use server";

  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  // Deep-link return target set by the middleware auth redirect. Validated
  // to a same-origin path BOTH here and at render (ZAP #65) — a hostile
  // value can never reach a redirect() or an HTML attribute.
  const next = safeNextPath(formData.get("next"), "");
  const nextSuffix = next ? `&next=${encodeURIComponent(next)}` : "";
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  if (!email || !password) redirect(`/login?error=missing_credentials${nextSuffix}`);

  const result = await identityAdminLogin(email, password);
  if (result.kind === "mfa") {
    const jar = await cookies();
    jar.set(
      MFA_CHALLENGE_COOKIE,
      encodeURIComponent(JSON.stringify({ token: result.mfaToken, method: result.mfaMethod, surface: "admin" })),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
        ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}),
      },
    );
    redirect("/login/mfa");
  }

  if (result.kind === "error") {
    const code = result.status === 401 ? "invalid_credentials" : result.status === 403 ? "wrong_surface" : "login_failed";
    redirect(`/login?error=${code}${nextSuffix}`);
  }

  const profile = toSessionProfile(result.user);
  if (!profile || !isAdminRole(profile.role)) redirect("/login?error=wrong_surface");

  const jar = await cookies();
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  redirect(next || ROLE_HOME[profile.role]);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  await requireAnonymous();
  const { error, next: nextRaw } = await searchParams;
  const next = safeNextPath(nextRaw, "");
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.login_failed) : null;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <span className="bg-gradient-to-r from-blue-700 to-sky-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                AIVO
              </span>
            </div>
            <span className="pl-6 text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-sky-600">
              Admin
            </span>
          </div>

          <div className="admin-card p-8">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">Admin Console</p>
            <h2 className="mt-3 admin-h1 text-3xl">Sign in with your administrator account</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Only school, district, platform, and authorized staff roles can enter this application.
            </p>

            <form id="admin-login-form" action={signInAction} className="mt-8 space-y-4">
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <label className="block text-sm font-semibold">
                Email
                <input className="admin-input mt-2" name="email" type="email" autoComplete="email" required />
              </label>
              <label className="block text-sm font-semibold">
                Password
                <input className="admin-input mt-2" name="password" type="password" autoComplete="current-password" required />
              </label>
              <button className="admin-button w-full" type="submit">
                Continue
              </button>
            </form>
            <SsoHint />

            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <p className="mt-6 text-center text-sm text-slate-500">
              Not an administrator?{" "}
              <Link className="font-semibold text-blue-700 underline" href="https://app.aivolearning.com/login">
                Use the learning app sign-in
              </Link>
              .
            </p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-1 text-center text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3" aria-hidden="true" />
              MFA-gated sign-in, verified on every protected route.
            </span>
            <span>admin.aivolearning.com</span>
          </div>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden lg:block" style={{ background: "var(--admin-login-sidebar)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_25%_85%,rgba(56,189,248,0.22),transparent_55%)]" />
        <div className="relative flex h-full flex-col items-center justify-center gap-8 px-10 py-14 text-center text-white">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-56 w-56 rounded-full bg-white/10" />
            <CloudMascot size={236} className="relative" />
          </div>
          <div className="max-w-sm">
            <h1 className="text-3xl font-bold leading-snug">
              Operational control plane <span className="text-sky-200">for learning systems.</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-blue-100">
              Admin access is isolated from the consumer app, MFA-gated by identity-svc, and verified on every protected route.
            </p>
          </div>
          <div className="flex max-w-sm items-start gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-xs leading-relaxed text-blue-50 backdrop-blur">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" aria-hidden="true" />
            <span>School, district, platform, and authorized staff roles only — every session is checked at the edge.</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
