import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { AuthSplitLayout, AuthSidePanel, AuthTrustCard, AuthSecureFooter } from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";
import { AudienceToggle } from "@/components/auth/audience-toggle";
import { loginAction, learnerSignInAction } from "@/lib/auth/auth-actions";
import { LoginForm } from "./_components/login-form";
import { LearnerPinForm } from "./_components/learner-pin-form";

/**
 * Login surface — parent / educator entry into AIVO.
 *
 * Redesign: the screen is the shared auth split layout (form card left,
 * cloud-mascot panel right) with the Adult / Learner audience toggle, a
 * static district-SSO affordance, and the "Secure sign-in powered by AIVO"
 * footer. All wiring (loginAction, learnerSignInAction, the email-driven
 * SSO discovery inside LoginForm) is unchanged — only the chrome moved.
 *
 * No inline hex. All interactive colors flow through `iw-*` Tailwind
 * utilities so the sensory-mode toggle repaints the surface without
 * re-wiring.
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
  "service_unavailable",
]);
const NOTICE_CODES = new Set(["password_reset", "logged_out"]);

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; notice?: string; mode?: string }>;
}) {
  const { error, notice, mode } = await searchParams;
  const loginMode = mode === "learner" ? "learner" : "adult";
  const t = await getTranslations("auth.login");
  const ts = await getTranslations("auth.shell");
  const errorMessage = error
    ? t(`errors.${ERROR_CODES.has(error) ? error : "login_failed"}` as never)
    : null;
  const noticeMessage = notice && NOTICE_CODES.has(notice) ? t(`notices.${notice}` as never) : null;

  return (
    <AuthSplitLayout
      panel={
        <AuthSidePanel
          variant="wave"
          title={t("panel_title")}
          accent={t("panel_accent")}
          body={t("panel_body")}
        >
          <AuthTrustCard>{ts("trust_districts")}</AuthTrustCard>
        </AuthSidePanel>
      }
    >
      <div className="flex flex-col gap-6">
        <AivoBrandMark />

        <AudienceToggle
          active={loginMode}
          adultHref="/login?mode=adult"
          learnerHref="/login?mode=learner"
          adultLabel={ts("mode_adult")}
          learnerLabel={ts("mode_learner")}
          ariaLabel={ts("mode_toggle_aria")}
        />

        <div className="text-center">
          <h1 className="font-iw-display text-2xl font-bold text-iw-ink">
            {loginMode === "learner" ? t("learner_title") : t("welcome_back")}
          </h1>
          <p className="mt-1.5 text-sm text-iw-ink-muted">
            {loginMode === "learner" ? t("learner_subtitle") : t("card_subtitle")}
          </p>
        </div>

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

        {loginMode === "learner" ? (
          <LearnerPinForm id="learner-pin-form" action={learnerSignInAction} />
        ) : (
          <LoginForm id="login-form" action={loginAction} />
        )}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            form={loginMode === "learner" ? "learner-pin-form" : "login-form"}
            variant="default"
            size="lg"
            className="w-full"
          >
            {loginMode === "learner" ? t("learner_submit") : t("submit")}
          </Button>

          {loginMode === "adult" ? (
            <>
              <div className="flex items-center gap-3 text-xs font-medium text-iw-ink-muted">
                <span className="h-px flex-1 bg-iw-border" />
                {ts("or")}
                <span className="h-px flex-1 bg-iw-border" />
              </div>
              <Link
                href="/district/login"
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-iw-border bg-iw-card px-7 text-sm font-semibold text-iw-ink transition hover:bg-iw-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg"
              >
                {t("sso_cta")}
              </Link>
            </>
          ) : null}
        </div>

        <p className="text-center text-sm text-iw-ink-muted">
          {t("new_here")}{" "}
          <Link
            href="/signup"
            className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
          >
            {t("create_account")}
          </Link>
          .
        </p>

        <AuthSecureFooter lead={ts("secure_signin")} sub={ts("encrypted")} />
      </div>
    </AuthSplitLayout>
  );
}
