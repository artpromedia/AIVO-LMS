import Link from "next/link";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { MOCK_USERS } from "@/lib/auth/mock-session";
import type { Role } from "@/lib/auth/types";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { LoginForm } from "./_components/login-form";

async function signInAction(formData: FormData) {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { ROLE_HOME } = await import("@/lib/auth/types");
  const { serverEnv } = await import("@/lib/env");

  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  // --- Mock path: developer affordance, identical to the previous
  // behavior so AUTH_MODE=mock dev workflows keep working. -----------
  if (serverEnv.AUTH_MODE === "mock") {
    const { MOCK_COOKIE_NAME } = await import("@/lib/auth/mock-session");
    const raw = formData.get("role");
    const role = (typeof raw === "string" ? raw : "parent") as Role;
    if (!(role in MOCK_USERS)) {
      redirect("/login?error=invalid_role");
    }
    const jar = await cookies();
    jar.set(MOCK_COOKIE_NAME, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect(ROLE_HOME[role]);
  }

  // --- Real path: services/identity-svc -----------------------------
  if (!email || !password) {
    redirect("/login?error=missing_credentials");
  }

  const {
    identityLogin,
    extractRefreshToken,
    toSessionProfile,
  } = await import("@/lib/auth/identity-client");
  const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");
  const { MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_MAX_AGE_SECONDS } = await import(
    "@/lib/auth/mfa-cookies"
  );

  const result = await identityLogin(email, password);

  if (result.kind === "mfa") {
    // Stash the mfaToken in a short-lived httpOnly cookie instead of the
    // URL so the bearer credential never appears in browser history,
    // server logs, or the Referer header. /login/mfa reads it back.
    const jar = await cookies();
    jar.set(
      MFA_CHALLENGE_COOKIE,
      encodeURIComponent(JSON.stringify({ token: result.mfaToken, method: result.mfaMethod })),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
      },
    );
    redirect("/login/mfa");
    return;
  }

  if (result.kind === "error") {
    // 403 + redirectTo: identity-svc is telling us the user belongs on a
    // different portal (admin / district). Forward them straight there
    // instead of stranding them on the consumer login with an opaque error.
    if (result.status === 403 && result.redirectTo) {
      const { isSafeSurfaceRedirect } = await import("@/lib/auth/surface-redirect");
      if (isSafeSurfaceRedirect(result.redirectTo)) {
        redirect(result.redirectTo);
      }
    }
    let code: string;
    if (result.status === 401) {
      code = "invalid_credentials";
    } else if (result.status === 403) {
      code = "wrong_surface";
    } else {
      code = "login_failed";
    }
    redirect(`/login?error=${code}`);
    return;
  }

  const profile = toSessionProfile(result.user);
  if (!profile) {
    redirect("/login?error=unsupported_role");
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

/**
 * Login surface — parent / educator entry into AIVO.
 *
 * Layout intent (post-Day-6 redesign):
 *
 *   < lg : single-column. Wordmark header above one form card. No bullet
 *          list, no reassurance card, no secondary chrome — the user is
 *          here to sign in, not be re-sold the product.
 *
 *   ≥ lg : two columns weighted toward the form. The left column is a
 *          quiet brand-presence strip (mark + a single line of context +
 *          a single decorative dot). It establishes "you're on AIVO"
 *          without competing with the form.
 *
 * No inline hex. No raw `<button>`. All interactive colors flow through
 * `iw-*` Tailwind utilities so the sensory-mode toggle repaints the
 * surface without re-wiring.
 */
const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  invalid_role: "That role isn't available for this account.",
  missing_credentials: "Enter your email and password to sign in.",
  mfa_required:
    "We need a verification code to finish signing you in. Please enter it on the next screen.",
  mfa_session_expired: "Your verification session expired. Please sign in again.",
  wrong_surface:
    "This account signs in on a different surface (district or admin). Use the correct portal.",
  unsupported_role: "Your account role isn't supported on this surface yet.",
  login_failed: "We couldn't sign you in. Please try again.",
};

const NOTICE_COPY: Record<string, string> = {
  password_reset: "Your password has been reset. Please sign in with your new password.",
  logged_out: "You've been signed out.",
};

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.login_failed) : null;
  const noticeMessage = notice ? (NOTICE_COPY[notice] ?? null) : null;
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12 lg:py-14"
      >
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          {/* Brand-presence strip — desktop only. Intentionally quiet
              but with enough body to balance the form card's height
              instead of leaving a gulf of empty space at the top of the
              page. */}
          <aside className="hidden lg:flex flex-col gap-6 max-w-md pt-2">
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
            >
              <AivoIcon name="aiSparkle" size={28} />
            </span>
            <h2 className="font-iw-display text-3xl font-bold leading-[1.1] text-iw-ink">
              Sign in to continue your AIVO journey.
            </h2>
            <p className="text-base leading-relaxed text-iw-ink-muted">
              Your tutors, missions, and family insights — all in one place,
              tuned for how your learner thinks.
            </p>
            {/* Quiet trust block. Mirrors the chrome strip in the marketing
                footer (COPPA · FERPA · SOC 2) so the brand side has the same
                weight as the form card without re-selling the product to a
                returning user. */}
            <div className="mt-2 flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 self-start rounded-full bg-iw-accent-soft px-3 py-1.5 text-xs font-semibold text-iw-primary">
                <AivoIcon name="safetyOk" size={14} />
                <span>COPPA · FERPA · SOC 2</span>
              </div>
              <blockquote className="border-l-2 border-iw-border pl-4 text-sm leading-relaxed text-iw-ink-muted">
                <p>
                  &ldquo;AIVO adapts to how my daughter actually learns. The
                  first platform that didn&rsquo;t make us feel like we were
                  fighting it.&rdquo;
                </p>
                <footer className="mt-2 text-xs font-semibold not-italic text-iw-ink-muted">
                  — Parent of a Grade 3 learner
                </footer>
              </blockquote>
            </div>
          </aside>

          {/* Form card — dominant on every breakpoint. */}
          <div className="flex flex-col gap-4">
            {/* Mobile-only header — replaces the desktop brand-presence strip. */}
            <div className="lg:hidden flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
              >
                <AivoIcon name="aiSparkle" size={22} />
              </span>
              <h2 className="font-iw-display text-2xl font-bold leading-tight text-iw-ink">
                Welcome back.
              </h2>
            </div>

            <AuthCard
              eyebrow="Sign in"
              title="Continue with your AIVO account"
              subtitle="Sign in with your AIVO email and password."
              actions={
                <>
                  <Button
                    type="submit"
                    form="login-form"
                    variant="default"
                    size="lg"
                    className="w-full"
                  >
                    Sign in
                  </Button>
                  <p className="text-sm text-iw-ink-muted text-center">
                    New here?{" "}
                    <Link
                      href="/signup"
                      className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                    >
                      Create an account
                    </Link>
                    .
                  </p>
                </>
              }
            >
              <LoginForm id="login-form" action={signInAction} />
            </AuthCard>

            {noticeMessage ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-iw-card border border-iw-success/40 bg-iw-success/10 px-4 py-3 text-sm text-iw-success"
              >
                {noticeMessage}
              </div>
            ) : null}

            {errorMessage ? (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-iw-card border border-iw-danger/40 bg-iw-danger/10 px-4 py-3 text-sm text-iw-danger"
              >
                {errorMessage}
              </div>
            ) : null}

            {/* Single-line privacy reassurance. Replaces the previous
                ReassuranceCard so the screen has one visual focus, not two. */}
            <p className="text-xs text-iw-ink-muted text-center">
              We never sell your data.{" "}
              <Link
                href="/onboarding/privacy"
                className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
              >
                Read the privacy notice
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
