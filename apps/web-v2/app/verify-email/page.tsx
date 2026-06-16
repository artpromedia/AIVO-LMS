import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { AuthInput } from "@aivo/ui/auth";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * Confirm a newly-registered email using a token from the verification
 * email. Identity-svc validates the token (24-hour TTL, single use) and
 * flips the account's `email_verified` flag.
 *
 * We verify behind an explicit "Confirm my email" button (a server action)
 * rather than on page load, so an inbox link-scanner that pre-fetches the
 * URL can't silently burn the single-use token before the human clicks.
 *
 * In mock mode there's no real token, so we surface an explanatory message
 * instead of submitting into the void.
 */
async function verifyEmailAction(formData: FormData) {
  "use server";
  const { serverEnv } = await import("@/lib/env");

  const tokenRaw = formData.get("token");
  const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";

  if (!token) {
    redirect("/verify-email?error=missing_token");
  }
  if (serverEnv.AUTH_MODE === "mock") {
    redirect("/verify-email?error=mock_mode");
  }

  const { identityVerifyEmail } = await import("@/lib/auth/identity-client");
  const result = await identityVerifyEmail(token);

  if (!result.ok) {
    const code = result.status === 400 ? "invalid_token" : "verify_failed";
    redirect(`/verify-email?token=${encodeURIComponent(token)}&error=${code}`);
  }

  redirect("/login?notice=email_verified");
}

async function resendVerificationAction(formData: FormData) {
  "use server";
  const { serverEnv } = await import("@/lib/env");

  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  if (!email) {
    redirect("/verify-email?error=missing_email");
  }
  if (serverEnv.AUTH_MODE === "mock") {
    redirect("/verify-email?error=mock_mode");
  }

  const { identitySendVerificationEmail } = await import("@/lib/auth/identity-client");
  // Response is intentionally generic (no account enumeration), so we always
  // land on the same reassuring notice regardless of whether a mail went out.
  await identitySendVerificationEmail(email);
  redirect("/verify-email?notice=resent");
}

// Recognized codes — copy lives in the i18n catalog under auth.verify.errors /
// auth.verify.notices. These sets gate which search-param values map to a
// real, translated message (anything else falls back to verify_failed).
const ERROR_CODES = new Set([
  "missing_token",
  "missing_email",
  "invalid_token",
  "verify_failed",
  "mock_mode",
]);
const NOTICE_CODES = new Set(["resent"]);

export default async function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ token?: string; error?: string; notice?: string }>;
}) {
  const { token = "", error, notice } = await searchParams;
  const t = await getTranslations("auth.verify");
  const errorMessage = error
    ? t(`errors.${ERROR_CODES.has(error) ? error : "verify_failed"}` as never)
    : null;
  const noticeMessage = notice && NOTICE_CODES.has(notice) ? t(`notices.${notice}` as never) : null;
  const hasToken = token.length > 0;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12 sm:py-16">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
          >
            <AivoIcon name="safetyOk" size={22} />
          </span>
          <h2 className="font-iw-display text-2xl font-bold leading-tight text-iw-ink">
            {t("heading")}
          </h2>
        </div>

        {hasToken ? (
          <AuthCard
            eyebrow={t("confirm_eyebrow")}
            title={t("confirm_title")}
            subtitle={t("confirm_subtitle")}
            actions={
              <Button type="submit" form="verify-form" variant="default" size="lg" className="w-full">
                {t("confirm_submit")}
              </Button>
            }
          >
            <form id="verify-form" action={verifyEmailAction} className="flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
            </form>
          </AuthCard>
        ) : (
          <AuthCard
            eyebrow={t("no_token_eyebrow")}
            title={t("no_token_title")}
            subtitle={t("no_token_subtitle")}
            actions={
              <Button type="submit" form="resend-form" variant="default" size="lg" className="w-full">
                {t("resend_cta")}
              </Button>
            }
          >
            <form id="resend-form" action={resendVerificationAction} className="flex flex-col gap-4">
              <p className="text-sm text-iw-ink-muted">{t("no_token_body")}</p>
              <AuthInput
                id="email"
                name="email"
                label={t("resend_email_label")}
                type="email"
                autoComplete="email"
                required
              />
              <p className="text-xs leading-relaxed text-iw-ink-muted">{t("resend_help")}</p>
            </form>
          </AuthCard>
        )}

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

        <p className="text-sm text-iw-ink-muted text-center">
          <Link
            href="/login"
            className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
          >
            {t("back_to_login")}
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
