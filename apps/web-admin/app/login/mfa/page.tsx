import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AuthCard, AuthInput, AuthShell } from "@aivo/ui/auth";
import {
  extractRefreshToken,
  identityResendMfa,
  identityVerifyMfa,
  isAdminRole,
  MFA_CHALLENGE_COOKIE,
  parseMfaChallengeCookie,
  ROLE_HOME,
  setAuthSessionCookies,
  toSessionProfile,
} from "@aivo/admin-auth";

async function verifyMfaAction(formData: FormData) {
  "use server";
  const codeRaw = formData.get("code");
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
  if (!code) redirect("/login/mfa?error=missing_code");

  const jar = await cookies();
  const challenge = parseMfaChallengeCookie(jar.get(MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) redirect("/login?error=mfa_session_expired");

  const result = await identityVerifyMfa(challenge.token, code);
  if (result.kind === "error") {
    if (result.status === 401 || result.status === 429) {
      jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
      redirect(result.status === 429 ? "/login/mfa?error=locked" : "/login?error=mfa_session_expired");
    }
    redirect("/login/mfa?error=invalid_code");
  }

  const profile = toSessionProfile(result.user);
  if (!profile || !isAdminRole(profile.role)) {
    jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    redirect("/login?error=wrong_surface");
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
  if (!challenge) redirect("/login?error=mfa_session_expired");

  const result = await identityResendMfa(challenge.token);
  if (!result.ok) {
    if (result.status === 401) {
      jar.set(MFA_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
      redirect("/login?error=mfa_session_expired");
    }
    redirect(result.status === 429 ? "/login/mfa?error=resend_exhausted" : "/login/mfa?error=resend_failed");
  }
  redirect("/login/mfa?notice=resent");
}

const ERROR_COPY: Record<string, string> = {
  missing_code: "Enter the MFA code to continue.",
  invalid_code: "That MFA code was not accepted.",
  locked: "Too many MFA attempts. Sign in again later.",
  resend_failed: "We could not resend the code.",
  resend_exhausted: "No MFA resends remain for this challenge.",
};

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const jar = await cookies();
  const challenge = parseMfaChallengeCookie(jar.get(MFA_CHALLENGE_COOKIE)?.value);
  if (!challenge) redirect("/login?error=mfa_session_expired");

  const { error, notice } = await searchParams;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.invalid_code) : null;

  return (
    <AuthShell
      brand={
        <>
          <div className="max-w-sm text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.42em] text-sky-200">AIVO Admin</p>
            <h1 className="mt-4 text-4xl font-bold leading-snug">
              Operational control plane <span className="text-sky-200">for learning systems.</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-blue-100">
              Keep the session on the admin surface by completing the MFA challenge issued by identity-svc.
            </p>
          </div>
          <div className="flex max-w-sm items-start gap-3 rounded-iw-card border border-white/20 bg-white/10 px-4 py-3 text-left text-xs leading-relaxed text-blue-50 backdrop-blur">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" aria-hidden="true" />
            <span>Every MFA challenge is single-use and verified before access is restored.</span>
          </div>
        </>
      }
      footer={<span>admin.aivolearning.com</span>}
    >
      <AuthCard eyebrow="MFA required" title="Verify your admin session" subtitle={`Complete the ${challenge.method} challenge issued by identity-svc.`}>
        <form id="mfa-form" action={verifyMfaAction} className="flex flex-col gap-4">
          <AuthInput
            id="admin-mfa-code"
            name="code"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </form>
        {challenge.method === "email" ? (
          <form action={resendMfaAction}>
            <button className="text-sm font-semibold text-iw-primary underline underline-offset-2" type="submit">
              Resend code
            </button>
          </form>
        ) : null}
        {notice === "resent" ? <p className="text-sm text-green-700">A new code was sent.</p> : null}
        {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        <div className="flex flex-col gap-3 pt-2">
          <button
            className="inline-flex min-h-12 items-center justify-center rounded-iw-control bg-(--aivo-sensory-primary) px-5 text-sm font-semibold text-white shadow-soft-3 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--aivo-sensory-primary)/30"
            type="submit"
            form="mfa-form"
          >
            Verify and continue
          </button>
          <Link className="text-center text-sm font-semibold text-iw-ink-muted underline underline-offset-2" href="/login">
            Cancel sign-in
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
