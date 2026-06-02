import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard, AuthInput } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MFA_CHALLENGE_COOKIE, parseMfaChallengeCookie } from "@/lib/auth/mfa-cookies";

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

  const { identityVerifyMfa, extractRefreshToken, toSessionProfile } =
    await import("@/lib/auth/identity-client");
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

// Recognized MFA error / notice codes. Copy lives in the i18n catalog
// under auth.mfa.errors / auth.mfa.notices.
const ERROR_CODES = new Set([
  "missing_code",
  "invalid_code",
  "locked",
  "resend_failed",
  "resend_exhausted",
]);
const NOTICE_CODES = new Set(["resent"]);

// Maps the MFA method to its catalog key prefix (totp_* / webauthn_* / email_*).
function methodPrefix(method: string): "totp" | "webauthn" | "email" {
  if (method === "totp") return "totp";
  if (method === "webauthn") return "webauthn";
  return "email";
}

export default async function MfaChallengePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const t = await getTranslations("auth.mfa");
  const errorMessage = error && ERROR_CODES.has(error) ? t(`errors.${error}` as never) : null;
  const noticeMessage = notice && NOTICE_CODES.has(notice) ? t(`notices.${notice}` as never) : null;

  const jar = await cookies();
  const challenge = parseMfaChallengeCookie(jar.get(MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) {
    redirect("/login?error=mfa_session_expired");
  }

  const prefix = methodPrefix(challenge.method);
  const title = t(`${prefix}_title` as never);
  const subtitle = t(`${prefix}_subtitle` as never);
  const cta = t(`${prefix}_cta` as never);
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

        <AuthCard
          eyebrow={t("card_eyebrow")}
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Button type="submit" form="mfa-form" variant="default" size="lg" className="w-full">
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
                    {t("resend_code")}
                  </Button>
                </form>
              ) : null}
              <p className="text-sm text-iw-ink-muted text-center">
                <Link
                  href="/login"
                  className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
                >
                  {t("cancel")}
                </Link>
              </p>
            </>
          }
        >
          <form id="mfa-form" action={verifyMfaAction} className="flex flex-col gap-4">
            <AuthInput
              id="code"
              name="code"
              label={t("code_label")}
              type="text"
              inputMode={challenge.method === "webauthn" ? "text" : "numeric"}
              autoComplete="one-time-code"
              placeholder={placeholder}
              required
              minLength={4}
              maxLength={32}
              autoFocus
            />
            <p className="text-xs text-iw-ink-muted">{t("recovery_hint")}</p>
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
