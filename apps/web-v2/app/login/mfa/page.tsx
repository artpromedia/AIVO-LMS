import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthInput } from "@aivo/ui/auth";
import { Button } from "@/components/ui/button";
import { MFA_CHALLENGE_COOKIE, parseMfaChallengeCookie } from "@/lib/auth/mfa-cookies";
import {
  AuthSplitLayout,
  AuthSidePanel,
  AuthTrustCard,
  AuthSecureFooter,
} from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";
import { OtpInput } from "@/components/auth/otp-input";
import { MfaResend } from "./_components/mfa-resend";

/**
 * MFA challenge surface. Reached when /api/auth/login returns
 * `mfaPending`. The mfaToken is held in an httpOnly cookie set by the
 * login server action — this page reads it, the verify server action
 * consumes it, and either clears it (success or terminal failure) or
 * leaves it in place so the user can retry.
 *
 * Redesign: shared auth split layout (form card left, cloud-mascot shield
 * panel right). Numeric methods (totp/email) use the 6-box OtpInput;
 * webauthn recovery codes fall back to a plain text field. All verify /
 * resend / cancel wiring is unchanged.
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
  const ts = await getTranslations("auth.shell");
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
  const isWebauthn = challenge.method === "webauthn";

  return (
    <AuthSplitLayout
      panel={
        <AuthSidePanel
          variant="shield"
          title={t("panel_title")}
          accent={t("panel_accent")}
          body={t("panel_body")}
        >
          <AuthTrustCard>{ts("trust_secure")}</AuthTrustCard>
        </AuthSidePanel>
      }
    >
      <div className="flex flex-col gap-6">
        <AivoBrandMark sublabel={ts("wordmark_account")} />

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-iw-primary">
            {t("card_eyebrow")}
          </p>
          <h1 className="mt-1 font-iw-display text-2xl font-bold text-iw-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-iw-ink-muted">{subtitle}</p>
        </div>

        {noticeMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-iw-card border border-iw-success/40 bg-iw-success/10 px-4 py-3 text-center text-sm text-iw-success"
          >
            {noticeMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-iw-card border border-iw-error/40 bg-iw-error/10 px-4 py-3 text-center text-sm text-iw-error"
          >
            {errorMessage}
          </div>
        ) : null}

        <form id="mfa-form" action={verifyMfaAction} className="flex flex-col gap-4">
          {isWebauthn ? (
            <AuthInput
              id="code"
              name="code"
              label={t("code_label")}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="XXXX-XXXX-XXXX"
              required
              minLength={4}
              maxLength={32}
              autoFocus
            />
          ) : (
            <OtpInput name="code" length={6} ariaLabel={t("code_label")} autoFocus />
          )}
          <p className="text-center text-xs text-iw-ink-muted">{t("recovery_hint")}</p>
        </form>

        <div className="flex flex-col gap-3">
          <Button type="submit" form="mfa-form" variant="default" size="lg" className="w-full">
            {cta}
          </Button>
          {canResend ? (
            <MfaResend
              action={resendMfaAction}
              idleLabel={t("resend_code")}
              countdownLabel={t("resend_in")}
            />
          ) : null}
          <p className="text-center text-sm text-iw-ink-muted">
            <Link
              href="/login"
              className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
            >
              {t("cancel")}
            </Link>
          </p>
        </div>

        <AuthSecureFooter lead={ts("secure_signin")} sub={ts("encrypted")} />
      </div>
    </AuthSplitLayout>
  );
}
