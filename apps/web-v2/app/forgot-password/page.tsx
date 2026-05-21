import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthInput } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * "Forgot password" entry point. We never confirm or deny whether the
 * submitted email is on file — identity-svc always returns the same
 * generic success message to prevent account enumeration. The screen
 * mirrors that and only ever shows the same confirmation copy.
 *
 * In AUTH_MODE=mock we don't hit the network at all but still show the
 * same confirmation so the UX is identical end-to-end during dev.
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

const ERROR_COPY: Record<string, string> = {
  invalid_email: "Enter a valid email address so we can find your account.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const errorMessage = error ? (ERROR_COPY[error] ?? null) : null;
  const sentAcknowledged = sent === "1";

  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12 sm:py-16"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
          >
            <AivoIcon name="aiSparkle" size={22} />
          </span>
          <h2 className="font-iw-display text-2xl font-bold leading-tight text-iw-ink">
            Reset your password
          </h2>
        </div>

        {sentAcknowledged ? (
          <AuthCard
            eyebrow="Check your inbox"
            title="If that email is registered, a reset link is on the way."
            subtitle="For your security, we don't reveal whether an account exists. The link expires in 1 hour."
            actions={
              <>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-iw-card bg-iw-primary px-4 py-3 font-semibold text-iw-on-primary hover:bg-iw-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg"
                >
                  Back to sign in
                </Link>
                <p className="text-sm text-iw-ink-muted text-center">
                  Didn't get it?{" "}
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                  >
                    Try a different email
                  </Link>
                  .
                </p>
              </>
            }
          >
            <p className="text-sm text-iw-ink-muted">
              Check spam or promotions if you don't see it after a minute. The link
              works once and then expires — request a new one if you need to start
              over.
            </p>
          </AuthCard>
        ) : (
          <AuthCard
            eyebrow="Forgot password"
            title="Enter the email on your account"
            subtitle="We'll email you a secure link to set a new password."
            actions={
              <>
                <Button
                  type="submit"
                  form="forgot-form"
                  variant="default"
                  size="lg"
                  className="w-full"
                >
                  Send reset link
                </Button>
                <p className="text-sm text-iw-ink-muted text-center">
                  Remembered it?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                  >
                    Sign in
                  </Link>
                  .
                </p>
              </>
            }
          >
            <form
              id="forgot-form"
              action={forgotPasswordAction}
              className="flex flex-col gap-4"
            >
              <AuthInput
                id="email"
                name="email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                autoFocus
              />
            </form>
          </AuthCard>
        )}

        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-iw-card border border-iw-danger/40 bg-iw-danger/10 px-4 py-3 text-sm text-iw-danger"
          >
            {errorMessage}
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
