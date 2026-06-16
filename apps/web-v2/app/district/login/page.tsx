import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth/types";
import {
  AuthSplitLayout,
  AuthSidePanel,
  AuthTrustCard,
  AuthSecureFooter,
} from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";
import { LoginForm } from "@/app/login/_components/login-form";

/**
 * District sign-in surface (district.aivolearning.com/district/login).
 *
 * Redesigned onto the shared auth split layout (form card left, cloud-mascot
 * panel right) so it matches /login, /signup, and the SSO start screen. All
 * wiring is unchanged — `signInAction` still calls identity-svc
 * `/api/auth/district-login`, which restricts to district-admin and
 * platform-admin roles and enforces MFA; only the chrome moved.
 */
const DISTRICT_ROLES: ReadonlyArray<Role> = ["district_admin", "platform_admin"];

async function signInAction(formData: FormData): Promise<void> {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { ROLE_HOME } = await import("@/lib/auth/types");

  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");
  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  if (!email || !password) {
    redirect("/district/login?error=missing_credentials");
  }

  const { identityDistrictLogin, extractRefreshToken, toSessionProfile } =
    await import("@/lib/auth/identity-client");
  const { setAuthSessionCookies } = await import("@/lib/auth/session-cookies");
  const { MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_MAX_AGE_SECONDS } =
    await import("@/lib/auth/mfa-cookies");

  const result = await identityDistrictLogin(email, password);

  if (result.kind === "mfa") {
    const jar = await cookies();
    jar.set(
      MFA_CHALLENGE_COOKIE,
      encodeURIComponent(
        JSON.stringify({ token: result.mfaToken, method: result.mfaMethod, surface: "district" }),
      ),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
      },
    );
    redirect("/login/mfa?surface=district");
    return;
  }

  if (result.kind === "error") {
    if (result.status === 403 && result.redirectTo) {
      const { isSafeSurfaceRedirect } = await import("@/lib/auth/surface-redirect");
      if (isSafeSurfaceRedirect(result.redirectTo)) {
        redirect(result.redirectTo);
      }
    }
    let code: string;
    if (result.status === 401) {
      code = "invalid_credentials";
    } else if (result.status === 403) {
      code = "wrong_surface";
    } else {
      code = "login_failed";
    }
    redirect(`/district/login?error=${code}`);
    return;
  }

  const profile = toSessionProfile(result.user);
  if (!profile || !DISTRICT_ROLES.includes(profile.role)) {
    redirect("/district/login?error=wrong_surface");
    return;
  }

  const jar = await cookies();
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  redirect(ROLE_HOME[profile.role]);
}

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  missing_credentials: "Enter your email and password to sign in.",
  wrong_surface: "This account isn't authorized for district sign-in. Use the correct portal.",
  login_failed: "We couldn't sign you in. Please try again.",
};

export default async function DistrictLoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("district_login");
  const ts = await getTranslations("auth.shell");
  const tp = await getTranslations("auth.sso_start");
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.login_failed) : null;

  return (
    <AuthSplitLayout
      panel={
        <AuthSidePanel
          variant="headset"
          title={tp("panel_title")}
          accent={tp("panel_accent")}
          body={tp("panel_body")}
        >
          <AuthTrustCard>{ts("trust_districts")}</AuthTrustCard>
        </AuthSidePanel>
      }
    >
      <div className="flex flex-col gap-6">
        <AivoBrandMark sublabel={ts("wordmark_schools")} />

        <div className="text-center">
          <h1 className="font-iw-display text-2xl font-bold text-iw-ink">{t("card_title")}</h1>
          <p className="mt-1.5 text-sm text-iw-ink-muted">
            For district administrators and platform administrators.
          </p>
        </div>

        <span className="inline-flex items-center justify-center gap-1.5 self-center rounded-full bg-iw-accent-soft px-3 py-1.5 text-xs font-semibold text-iw-primary">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t("security_badge")}
        </span>

        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-iw-card border border-iw-error/40 bg-iw-error/10 px-4 py-3 text-sm text-iw-error"
          >
            {errorMessage}
          </div>
        ) : null}

        <LoginForm id="district-login-form" action={signInAction} />

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            form="district-login-form"
            variant="default"
            size="lg"
            className="w-full"
          >
            {t("sign_in_btn")}
          </Button>
          <p className="text-center text-sm text-iw-ink-muted">
            Not a district administrator?{" "}
            <Link
              href="/login"
              className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
            >
              {t("standard_sign_in")}
            </Link>
            .
          </p>
        </div>

        <AuthSecureFooter lead={ts("secure_signin")} sub={ts("encrypted")} />
      </div>
    </AuthSplitLayout>
  );
}
