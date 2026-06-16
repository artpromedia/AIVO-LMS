import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthInput } from "@aivo/ui/auth";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AuthSplitLayout,
  AuthSidePanel,
  AuthTrustCard,
  AuthSecureFooter,
} from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";

/**
 * "Forgot password" entry point. We never confirm or deny whether the
 * submitted email is on file — identity-svc always returns the same
 * generic success message to prevent account enumeration. The screen
 * mirrors that and only ever shows the same confirmation copy.
 *
 * In AUTH_MODE=mock we don't hit the network at all but still show the
 * same confirmation so the UX is identical end-to-end during dev.
 *
 * Redesign: shared auth split layout (form card left, cloud-mascot panel
 * right). The submit/confirmation wiring is unchanged.
 */
async function forgotPasswordAction(formData: FormData) {
  "use server";
  const { serverEnv } = await import("@/lib/env");

  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";

  // Validate minimally — identity-svc requires a syntactically valid
  // email, and we want to give the user a clean error if they typo it.
  if (!email || !/.+@.+\..+/.test(email)) {
    redirect("/forgot-password?error=invalid_email");
  }

  if (serverEnv.AUTH_MODE === "mock") {
    redirect("/forgot-password?sent=1");
  }

  const { identityForgotPassword } = await import("@/lib/auth/identity-client");
  // Result is intentionally ignored: identity-svc always returns 200
  // OK with the same generic message, and we surface the same
  // confirmation here either way.
  await identityForgotPassword(email);
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const t = await getTranslations("auth.forgot");
  const ts = await getTranslations("auth.shell");
  const errorMessage = error === "invalid_email" ? t("error_invalid_email") : null;
  const sentAcknowledged = sent === "1";

  return (
    <AuthSplitLayout
      panel={
        <AuthSidePanel
          variant={sentAcknowledged ? "shield" : "headset"}
          title={sentAcknowledged ? t("panel_title") : t("panel_help_title")}
          accent={sentAcknowledged ? undefined : t("panel_help_accent")}
          body={sentAcknowledged ? t("panel_body") : t("panel_help_body")}
        >
          <AuthTrustCard>{ts("trust_support")}</AuthTrustCard>
        </AuthSidePanel>
      }
    >
      <div className="flex flex-col gap-6">
        <AivoBrandMark sublabel={ts("wordmark_account")} />

        {sentAcknowledged ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-iw-accent-soft text-iw-primary">
              <MailCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-iw-display text-2xl font-bold text-iw-ink">{t("sent_title")}</h1>
              <p className="mt-2 text-sm text-iw-ink-muted">{t("sent_body")}</p>
            </div>
            <Button asChild size="lg" className="w-full">
              <Link href="/login">{t("back_to_sign_in")}</Link>
            </Button>
            <p className="text-xs text-iw-ink-muted">{t("sent_subtitle")}</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="font-iw-display text-2xl font-bold text-iw-ink">{t("form_title")}</h1>
              <p className="mt-1.5 text-sm text-iw-ink-muted">{t("form_subtitle")}</p>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-iw-card border border-iw-danger/40 bg-iw-danger/10 px-4 py-3 text-sm text-iw-danger"
              >
                {errorMessage}
              </div>
            ) : null}

            <form id="forgot-form" action={forgotPasswordAction} className="flex flex-col gap-4">
              <AuthInput
                id="email"
                name="email"
                label={t("email_label")}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </form>

            <Button type="submit" form="forgot-form" size="lg" className="w-full">
              {t("submit")}
            </Button>

            <p className="text-center text-sm text-iw-ink-muted">
              <Link
                href="/login"
                className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
              >
                {t("back_to_sign_in")}
              </Link>
            </p>
          </>
        )}

        <AuthSecureFooter lead={ts("secure_signin")} sub={ts("encrypted")} />
      </div>
    </AuthSplitLayout>
  );
}
