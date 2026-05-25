import Link from "next/link";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth/types";
import { requireAnonymous } from "@/lib/auth/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { LoginForm } from "@/app/login/_components/login-form";

/**
 * Admin sign-in surface (admin.aivolearning.com/admin/login).
 *
 * Calls identity-svc `/api/auth/admin-login`, which enforces MFA and
 * rejects any account whose role isn't in the admin set. On success the
 * user is routed to their role-home (school/district/platform admin).
 */
const ADMIN_ROLES: ReadonlyArray<Role> = ["school_admin", "district_admin", "platform_admin"];

async function signInAction(formData: FormData): Promise<void> {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { ROLE_HOME } = await import("@/lib/auth/types");

  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  if (!email || !password) {
    redirect("/admin/login?error=missing_credentials");
  }

  const {
    identityAdminLogin,
    extractRefreshToken,
    toSessionProfile,
  } = await import("@/lib/auth/identity-client");
  const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");
  const { MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_MAX_AGE_SECONDS } = await import(
    "@/lib/auth/mfa-cookies"
  );

  const result = await identityAdminLogin(email, password);

  if (result.kind === "mfa") {
    const jar = await cookies();
    jar.set(
      MFA_CHALLENGE_COOKIE,
      encodeURIComponent(
        JSON.stringify({ token: result.mfaToken, method: result.mfaMethod, surface: "admin" }),
      ),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
      },
    );
    redirect("/login/mfa?surface=admin");
    return;
  }

  if (result.kind === "error") {
    let code: string;
    if (result.status === 401) {
      code = "invalid_credentials";
    } else if (result.status === 403) {
      code = "wrong_surface";
    } else {
      code = "login_failed";
    }
    redirect(`/admin/login?error=${code}`);
    return;
  }

  const profile = toSessionProfile(result.user);
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    redirect("/admin/login?error=wrong_surface");
    return;
  }

  const jar = await cookies();
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  redirect(ROLE_HOME[profile.role]);
}

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  missing_credentials: "Enter your email and password to sign in.",
  wrong_surface: "This account isn't authorized for admin sign-in. Use the correct portal.",
  login_failed: "We couldn't sign you in. Please try again.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string }>;
}) {
  // Anonymous-access page: signed-out visitors render the sign-in form;
  // already-authenticated admins are redirected to their role home so
  // they don't see the login surface twice.
  await requireAnonymous(ADMIN_ROLES);
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.login_failed) : null;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12 lg:py-14">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <aside className="hidden lg:flex flex-col gap-6 max-w-md pt-2">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
            >
              <AivoIcon name="aiSparkle" size={28} />
            </span>
            <h2 className="font-iw-display text-3xl font-bold leading-[1.1] text-iw-ink">
              Admin sign-in
            </h2>
            <p className="text-base leading-relaxed text-iw-ink-muted">
              Platform, district, and school administrators sign in here. Multi-factor
              authentication is required for every session.
            </p>
            <div className="mt-2 inline-flex items-center gap-2 self-start rounded-full bg-iw-accent-soft px-3 py-1.5 text-xs font-semibold text-iw-primary">
              <AivoIcon name="safetyOk" size={14} />
              <span>MFA enforced · SOC 2 · FERPA</span>
            </div>
          </aside>

          <div className="flex flex-col gap-4">
            <div className="lg:hidden flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
              >
                <AivoIcon name="aiSparkle" size={22} />
              </span>
              <h2 className="font-iw-display text-2xl font-bold leading-tight text-iw-ink">
                Admin sign-in
              </h2>
            </div>

            <AuthCard
              eyebrow="Administration"
              title="Sign in to the admin console"
              subtitle="For school, district, and platform administrators."
              actions={
                <>
                  <Button
                    type="submit"
                    form="admin-login-form"
                    variant="default"
                    size="lg"
                    className="w-full"
                  >
                    Sign in
                  </Button>
                  <p className="text-sm text-iw-ink-muted text-center">
                    Not an administrator?{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                    >
                      Use the standard sign-in
                    </Link>
                    .
                  </p>
                </>
              }
            >
              <LoginForm id="admin-login-form" action={signInAction} />
            </AuthCard>

            {errorMessage ? (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-iw-card border border-iw-danger/40 bg-iw-danger/10 px-4 py-3 text-sm text-iw-danger"
              >
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
