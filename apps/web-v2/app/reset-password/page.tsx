import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ResetPasswordFields } from "./_components/reset-password-fields";

/**
 * Set a new password using a token from a reset email. Identity-svc
 * validates the token (1-hour TTL, single use), enforces the password
 * policy (length / breach list / history depth), and clears every
 * active session on success so the user is forced to sign in fresh.
 *
 * In mock mode there's no real token, so we render an explanatory
 * message instead of letting the form submit into the void.
 */
async function resetPasswordAction(formData: FormData) {
  "use server";
  const { serverEnv } = await import("@/lib/env");

  const tokenRaw = formData.get("token");
  const passwordRaw = formData.get("password");
  const confirmRaw = formData.get("confirm");

  const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";
  const confirm = typeof confirmRaw === "string" ? confirmRaw : "";

  if (!token) {
    redirect("/reset-password?error=missing_token");
  }
  if (!password || password.length < 12) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=weak_password`);
  }
  if (password !== confirm) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=mismatch`);
  }

  if (serverEnv.AUTH_MODE === "mock") {
    // Nothing on the backend to talk to. Surface a hint and bounce.
    redirect("/reset-password?error=mock_mode");
  }

  const { identityResetPassword } = await import("@/lib/auth/identity-client");
  const result = await identityResetPassword(token, password);

  if (!result.ok) {
    let code = "reset_failed";
    if (result.status === 400 && (result.reasons?.length ?? 0) > 0) {
      code = "policy_violation";
    } else if (result.status === 400) {
      code = "invalid_token";
    }
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${code}` +
        (result.reasons?.length ? `&detail=${encodeURIComponent(result.reasons.join("|"))}` : ""),
    );
  }

  redirect("/login?notice=password_reset");
}

// Recognized reset error codes — the copy lives in the i18n catalog under
// auth.reset.errors. This set just gates which search-param values map to
// a real, translated message (anything else falls back to reset_failed).
const ERROR_CODES = new Set([
  "missing_token",
  "weak_password",
  "mismatch",
  "invalid_token",
  "policy_violation",
  "reset_failed",
  "mock_mode",
]);

export default async function ResetPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    token?: string;
    error?: string;
    detail?: string;
  }>;
}) {
  const { token = "", error, detail } = await searchParams;
  const t = await getTranslations("auth.reset");
  const errorMessage = error
    ? t(`errors.${ERROR_CODES.has(error) ? error : "reset_failed"}` as never)
    : null;
  const reasons = error === "policy_violation" && detail ? detail.split("|") : null;
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

        {!hasToken ? (
          <AuthCard
            eyebrow={t("no_token_eyebrow")}
            title={t("no_token_title")}
            subtitle={t("no_token_subtitle")}
            actions={
              <Link
                href="/forgot-password"
                className="inline-flex w-full items-center justify-center rounded-iw-card bg-iw-primary px-4 py-3 font-semibold text-iw-on-primary hover:bg-iw-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg"
              >
                {t("no_token_cta")}
              </Link>
            }
          >
            <p className="text-sm text-iw-ink-muted">{t("no_token_body")}</p>
          </AuthCard>
        ) : (
          <AuthCard
            eyebrow={t("form_eyebrow")}
            title={t("form_title")}
            subtitle={t("form_subtitle")}
            actions={
              <>
                <Button
                  type="submit"
                  form="reset-form"
                  variant="default"
                  size="lg"
                  className="w-full"
                >
                  {t("submit")}
                </Button>
                <p className="text-sm text-iw-ink-muted text-center">
                  {t("need_link")}{" "}
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                  >
                    {t("start_over")}
                  </Link>
                  .
                </p>
              </>
            }
          >
            <form id="reset-form" action={resetPasswordAction} className="flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <ResetPasswordFields id="reset" />
            </form>
          </AuthCard>
        )}

        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-iw-card border border-iw-danger/40 bg-iw-danger/10 px-4 py-3 text-sm text-iw-danger"
          >
            <p>{errorMessage}</p>
            {reasons && reasons.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
