import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { MOCK_USERS } from "@/lib/auth/mock-session";
import type { Role } from "@/lib/auth/types";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { LoginForm } from "./_components/login-form";
import { LearnerPinForm } from "./_components/learner-pin-form";

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

  // --- Development path: developer affordance, identical to the previous
  // behavior so AUTH_MODE=development workflows keep working. -----------
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

  const { identityLogin, extractRefreshToken, toSessionProfile } =
    await import("@/lib/auth/identity-client");
  const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");
  const { MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_MAX_AGE_SECONDS } =
    await import("@/lib/auth/mfa-cookies");

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

async function learnerSignInAction(formData: FormData) {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { ROLE_HOME } = await import("@/lib/auth/types");
  const { identityPinLogin, extractRefreshToken, toSessionProfile } = await import("@/lib/auth/identity-client");
  const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");

  const parentId = String(formData.get("parentId") ?? "").trim();
  const learnerId = String(formData.get("learnerId") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!parentId || !learnerId || !/^\d{4,6}$/.test(pin)) {
    redirect("/login?mode=learner&error=missing_credentials");
  }

  const result = await identityPinLogin({ parentId, learnerId, pin });
  if (result.kind === "ok") {
    const profile = toSessionProfile(result.user);
    if (!profile || profile.role !== "learner" || profile.learnerId !== learnerId) {
      redirect("/login?mode=learner&error=unsupported_role");
      throw new Error("unsupported learner PIN session");
    }
    const learnerProfile = profile;
    const jar = await cookies();
    setAuthSessionCookies(jar, {
      accessToken: result.accessToken,
      refreshToken: extractRefreshToken(result.setCookies),
      profile: learnerProfile,
    });
    redirect(ROLE_HOME.learner);
  }
  if (result.kind === "error") {
    redirect(`/login?mode=learner&error=${"invalid_credentials"}`);
  }
  redirect("/login?mode=learner&error=invalid_credentials");
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
// Recognized error / notice codes. The copy itself lives in the i18n
// catalog under auth.login.errors / auth.login.notices — these sets just
// gate which search-param values map to a real, translated message.
const ERROR_CODES = new Set([
  "invalid_credentials",
  "invalid_role",
  "missing_credentials",
  "mfa_required",
  "mfa_session_expired",
  "wrong_surface",
  "unsupported_role",
  "login_failed",
]);
const NOTICE_CODES = new Set(["password_reset", "logged_out", "email_verified"]);

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; notice?: string; mode?: string }>;
}) {
  const { error, notice, mode } = await searchParams;
  const loginMode = mode === "learner" ? "learner" : "adult";
  const t = await getTranslations("auth.login");
  const errorMessage = error
    ? t(`errors.${ERROR_CODES.has(error) ? error : "login_failed"}` as never)
    : null;
  const noticeMessage = notice && NOTICE_CODES.has(notice) ? t(`notices.${notice}` as never) : null;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-12 lg:py-14">
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
              {t("brand_heading")}
            </h2>
            <p className="text-base leading-relaxed text-iw-ink-muted">{t("brand_body")}</p>
            {/* Quiet trust block. Mirrors the chrome strip in the marketing
                footer (COPPA · FERPA · SOC 2) so the brand side has the same
                weight as the form card without re-selling the product to a
                returning user. */}
            <div className="mt-2 flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 self-start rounded-full bg-iw-accent-soft px-3 py-1.5 text-xs font-semibold text-iw-primary">
                <AivoIcon name="safetyOk" size={14} />
                <span>{t("trust_badge")}</span>
              </div>
              <blockquote className="border-l-2 border-iw-border pl-4 text-sm leading-relaxed text-iw-ink-muted">
                <p>&ldquo;{t("quote")}&rdquo;</p>
                <footer className="mt-2 text-xs font-semibold not-italic text-iw-ink-muted">
                  {t("quote_attribution")}
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
                {t("welcome_back")}
              </h2>
            </div>

            <AuthCard
              eyebrow={t("card_eyebrow")}
              title={loginMode === "learner" ? t("learner_title") : t("card_title")}
              subtitle={loginMode === "learner" ? t("learner_subtitle") : t("card_subtitle")}
              actions={
                <>
                  <Button
                    type="submit"
                    form={loginMode === "learner" ? "learner-pin-form" : "login-form"}
                    variant="default"
                    size="lg"
                    className="w-full"
                  >
                    {loginMode === "learner" ? t("learner_submit") : t("submit")}
                  </Button>
                  <p className="text-sm text-iw-ink-muted text-center">
                    {t("new_here")}{" "}
                    <Link
                      href="/signup"
                      className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                    >
                      {t("create_account")}
                    </Link>
                    .
                  </p>
                </>
              }
            >
              <div className="mb-5 grid grid-cols-2 rounded-full bg-iw-card p-1 text-sm font-semibold" role="tablist" aria-label={t("mode_toggle_label")}>
                <Link href="/login?mode=learner" role="tab" aria-selected={loginMode === "learner"} className={`rounded-full px-3 py-2 text-center ${loginMode === "learner" ? "bg-iw-primary text-white" : "text-iw-ink-muted hover:text-iw-ink"}`}>
                  {t("mode_learner")}
                </Link>
                <Link href="/login?mode=adult" role="tab" aria-selected={loginMode === "adult"} className={`rounded-full px-3 py-2 text-center ${loginMode === "adult" ? "bg-iw-primary text-white" : "text-iw-ink-muted hover:text-iw-ink"}`}>
                  {t("mode_adult")}
                </Link>
              </div>
              {loginMode === "learner" ? (
                <LearnerPinForm id="learner-pin-form" action={learnerSignInAction} />
              ) : (
                <LoginForm id="login-form" action={signInAction} />
              )}
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
              {t("privacy_lead")}{" "}
              <Link
                href="/onboarding/privacy"
                className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
              >
                {t("privacy_link")}
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
