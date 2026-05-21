import Link from "next/link";
import { redirect } from "next/navigation";
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
        (result.reasons?.length
          ? `&detail=${encodeURIComponent(result.reasons.join("|"))}`
          : ""),
    );
  }

  redirect("/login?notice=password_reset");
}

const ERROR_COPY: Record<string, string> = {
  missing_token:
    "This reset link is missing its security token. Request a new link from the forgot-password page.",
  weak_password: "Your new password must be at least 12 characters long.",
  mismatch: "The two passwords don't match yet. Try entering them again.",
  invalid_token:
    "This reset link has expired or has already been used. Request a new link to continue.",
  policy_violation:
    "That password doesn't meet our policy. See the details below and try a stronger one.",
  reset_failed: "We couldn't reset your password. Please try again in a moment.",
  mock_mode:
    "Password reset is disabled in mock mode. Run with AUTH_MODE=custom and the identity service to test this flow.",
};

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
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.reset_failed) : null;
  const reasons = error === "policy_violation" && detail ? detail.split("|") : null;
  const hasToken = token.length > 0;

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
            <AivoIcon name="safetyOk" size={22} />
          </span>
          <h2 className="font-iw-display text-2xl font-bold leading-tight text-iw-ink">
            Choose a new password
          </h2>
        </div>

        {!hasToken ? (
          <AuthCard
            eyebrow="Reset password"
            title="This reset link is incomplete"
            subtitle="The link in your email is missing its security token. Request a new one to continue."
            actions={
              <Link
                href="/forgot-password"
                className="inline-flex w-full items-center justify-center rounded-iw-card bg-iw-primary px-4 py-3 font-semibold text-iw-on-primary hover:bg-iw-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg"
              >
                Request a new link
              </Link>
            }
          >
            <p className="text-sm text-iw-ink-muted">
              For your security, reset links expire after 1 hour and can only be used once.
            </p>
          </AuthCard>
        ) : (
          <AuthCard
            eyebrow="Reset password"
            title="Set your new password"
            subtitle="Choose something memorable but hard to guess. We'll sign you out of every device once you're done."
            actions={
              <>
                <Button
                  type="submit"
                  form="reset-form"
                  variant="default"
                  size="lg"
                  className="w-full"
                >
                  Save new password
                </Button>
                <p className="text-sm text-iw-ink-muted text-center">
                  Need a new link?{" "}
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                  >
                    Start over
                  </Link>
                  .
                </p>
              </>
            }
          >
            <form
              id="reset-form"
              action={resetPasswordAction}
              className="flex flex-col gap-4"
            >
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
