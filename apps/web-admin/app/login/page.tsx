import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
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
    <main className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <section className="hidden flex-col justify-between bg-[#0d2748] p-12 text-white lg:flex">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-200">AIVO Admin</p>
          <h1 className="mt-8 max-w-xl text-6xl font-black leading-[0.95]">
            Operational control plane for learning systems.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-blue-100">
            Admin access is isolated from the consumer app, MFA-gated by identity-svc, and verified on every protected route.
          </p>
        </div>
        <p className="text-sm text-blue-200">admin.aivolearning.com</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="admin-card w-full max-w-md p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">Admin Console</p>
          <h2 className="mt-4 text-3xl font-black">Sign in with your administrator account</h2>
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
      </section>
    </main>
  );
}
