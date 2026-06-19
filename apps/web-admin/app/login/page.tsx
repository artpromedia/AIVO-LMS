import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { AuthCard, AuthInput, AuthShell } from "@aivo/ui/auth";
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
    let code: string;
    if (result.status === 401) code = "invalid_credentials";
    else if (result.status === 403) code = "wrong_surface";
    else code = "login_failed";
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
  readonly searchParams: Promise<{ error?: string; next?: string }>;
}) {
  await requireAnonymous();
  const { error, next: nextRaw } = await searchParams;
  const next = safeNextPath(nextRaw, "");
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.login_failed) : null;

  return (
    <AuthShell
      brand={
        <>
          <div className="relative flex items-center justify-center">
            <div className="absolute h-56 w-56 rounded-full bg-white/10" />
            <CloudMascot size={236} className="relative" />
          </div>
          <div className="max-w-sm text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.42em] text-sky-200">AIVO Admin</p>
            <h1 className="mt-4 text-4xl font-bold leading-snug">
              Operational control plane <span className="text-sky-200">for learning systems.</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-blue-100">
              Admin access is isolated from the consumer app, MFA-gated by identity-svc, and verified on every protected route.
            </p>
          </div>
          <div className="flex max-w-sm items-start gap-3 rounded-iw-card border border-white/20 bg-white/10 px-4 py-3 text-left text-xs leading-relaxed text-blue-50 backdrop-blur">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" aria-hidden="true" />
            <span>School, district, platform, and authorized staff roles only — every session is checked at the edge.</span>
          </div>
        </>
      }
      footer={
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3 w-3" aria-hidden="true" />
          MFA-gated sign-in, verified on every protected route.
        </span>
      }
    >
      <AuthCard
        eyebrow="Admin console"
        title="Sign in with your administrator account"
        subtitle="Only school, district, platform, and authorized staff roles can enter this application."
      >
        <form id="admin-login-form" action={signInAction} className="flex flex-col gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <AuthInput id="admin-email" name="email" label="Email" type="email" autoComplete="email" required />
          <AuthInput
            id="admin-password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />
        </form>

        <SsoHint />

        {errorMessage ? (
          <div role="alert" aria-live="polite" className="rounded-iw-card border border-iw-error/40 bg-iw-error/10 px-4 py-3 text-sm text-iw-error">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-2">
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-iw-control bg-(--aivo-sensory-primary) px-5 text-sm font-semibold text-white shadow-soft-3 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--aivo-sensory-primary)/30"
            type="submit"
            form="admin-login-form"
          >
            Continue
          </button>
          <p className="text-center text-sm text-iw-ink-muted">
            Not an administrator?{" "}
            <Link className="font-semibold text-iw-primary underline underline-offset-2" href="https://app.aivolearning.com/login">
              Use the learning app sign-in
            </Link>
            .
          </p>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
