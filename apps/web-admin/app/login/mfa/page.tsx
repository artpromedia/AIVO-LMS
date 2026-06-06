import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="admin-card w-full max-w-md p-8">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">MFA Required</p>
        <h1 className="mt-4 text-3xl font-black">Verify your admin session</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Complete the {challenge.method} challenge issued by identity-svc.
        </p>
        <form id="mfa-form" action={verifyMfaAction} className="mt-8 space-y-4">
          <label className="block text-sm font-semibold">
            Verification code
            <input className="admin-input mt-2" name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <button className="admin-button w-full" type="submit">
            Verify and continue
          </button>
        </form>
        {challenge.method === "email" ? (
          <form action={resendMfaAction} className="mt-3">
            <button className="w-full rounded-full px-4 py-2 text-sm font-semibold text-blue-700" type="submit">
              Resend code
            </button>
          </form>
        ) : null}
        {notice === "resent" ? <p className="mt-4 text-sm text-green-700">A new code was sent.</p> : null}
        {errorMessage ? <p className="mt-4 text-sm text-red-700">{errorMessage}</p> : null}
        <Link className="mt-5 inline-block text-sm font-semibold text-slate-600 underline" href="/login">
          Cancel sign-in
        </Link>
      </section>
    </main>
  );
}
