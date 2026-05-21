import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthCard, AuthInput } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  MFA_CHALLENGE_COOKIE,
  parseMfaChallengeCookie,
} from "@/lib/auth/mfa-cookies";

/**
 * MFA challenge surface. Reached when /api/auth/login returns
 * `mfaPending`. The mfaToken is held in an httpOnly cookie set by the
 * login server action — this page reads it, the verify server action
 * consumes it, and either clears it (success or terminal failure) or
 * leaves it in place so the user can retry.
 */
async function verifyMfaAction(formData: FormData) {
  "use server";

  const codeRaw = formData.get("code");
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
  if (!code) {
    redirect("/login/mfa?error=missing_code");
  }

  const jar = await cookies();
  const challenge = parseMfaChallengeCookie(jar.get(MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) {
    redirect("/login?error=mfa_session_expired");
  }

  const { identityVerifyMfa, extractRefreshToken, toSessionProfile } = await import(
    "@/lib/auth/identity-client"
  );
  const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");
  const { ROLE_HOME } = await import("@/lib/auth/types");

  const result = await identityVerifyMfa(challenge.token, code);

  if (result.kind === "error") {
    // 401 = expired mfaToken (need to sign in again); 429 = locked.
    // Everything else (incl. 400 "Invalid code") we let the user retry
    // on the same screen.
    if (result.status === 401) {
      jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
      redirect("/login?error=mfa_session_expired");
    }
    if (result.status === 429) {
      jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
      redirect("/login/mfa?error=locked");
    }
    redirect("/login/mfa?error=invalid_code");
  }

  const profile = toSessionProfile(result.user);
  if (!profile) {
    jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    redirect("/login?error=unsupported_role");
  }

  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });
  jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
  redirect(ROLE_HOME[profile.role]);
}

async function resendMfaAction() {
  "use server";
  const jar = await cookies();
  const challenge = parseMfaChallengeCookie(jar.get(MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) {
    redirect("/login?error=mfa_session_expired");
  }
  const { identityResendMfa } = await import("@/lib/auth/identity-client");
  const result = await identityResendMfa(challenge.token);
  if (!result.ok) {
    if (result.status === 401) {
      jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
      redirect("/login?error=mfa_session_expired");
    }
    if (result.status === 429) {
      redirect("/login/mfa?error=resend_exhausted");
    }
    redirect("/login/mfa?error=resend_failed");
  }
  redirect("/login/mfa?notice=resent");
}

const ERROR_COPY: Record<string, string> = {
  missing_code: "Enter the verification code we sent to continue.",
  invalid_code: "That code doesn't match. Double-check and try again.",
  locked:
    "Too many failed attempts. Your account is temporarily locked — please try again in a few minutes.",
  resend_failed: "We couldn't send a new code. Please try again.",
  resend_exhausted: "You've reached the resend limit. Please sign in again to get a fresh code.",
};

const NOTICE_COPY: Record<string, string> = {
  resent: "A new code has been sent to your email.",
};

function describeMethod(method: string): { title: string; subtitle: string; cta: string } {
  if (method === "totp") {
    return {
      title: "Enter your authenticator code",
      subtitle:
        "Open your authenticator app and enter the 6-digit code shown for AIVO Learning.",
      cta: "Verify code",
    };
  }
  if (method === "webauthn") {
    return {
      title: "Use your passkey to continue",
      subtitle:
        "Your account is protected by a passkey. Passkey sign-in isn't supported on this surface yet — use a recovery code below.",
      cta: "Verify recovery code",
    };
  }
  return {
    title: "Enter your verification code",
    subtitle:
      "We sent a 6-digit code to the email on file. It expires in 10 minutes.",
    cta: "Verify code",
  };
}

export default async function MfaChallengePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const errorMessage = error ? (ERROR_COPY[error] ?? null) : null;
  const noticeMessage = notice ? (NOTICE_COPY[notice] ?? null) : null;

  const jar = await cookies();
  const challenge = parseMfaChallengeCookie(jar.get(MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) {
    redirect("/login?error=mfa_session_expired");
  }

  const { title, subtitle, cta } = describeMethod(challenge.method);
  const canResend = challenge.method === "email";
  const placeholder =
    challenge.method === "totp"
      ? "123456"
      : challenge.method === "webauthn"
        ? "XXXX-XXXX-XXXX"
        : "123456";

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
            Verify it's you
          </h2>
        </div>

        <AuthCard
          eyebrow="Multi-factor sign-in"
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Button
                type="submit"
                form="mfa-form"
                variant="default"
                size="lg"
                className="w-full"
              >
                {cta}
              </Button>
              {canResend ? (
                <form action={resendMfaAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="w-full text-iw-primary"
                  >
                    Resend code
                  </Button>
                </form>
              ) : null}
              <p className="text-sm text-iw-ink-muted text-center">
                <Link
                  href="/login"
                  className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                >
                  Cancel and sign in again
                </Link>
              </p>
            </>
          }
        >
          <form id="mfa-form" action={verifyMfaAction} className="flex flex-col gap-4">
            <AuthInput
              id="code"
              name="code"
              label="Verification code"
              type="text"
              inputMode={challenge.method === "webauthn" ? "text" : "numeric"}
              autoComplete="one-time-code"
              placeholder={placeholder}
              required
              minLength={4}
              maxLength={32}
              autoFocus
            />
            <p className="text-xs text-iw-ink-muted">
              Lost access? Use one of the recovery codes you saved when you turned on
              MFA — enter it in the field above.
            </p>
          </form>
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
      </main>
      <SiteFooter />
    </>
  );
}
