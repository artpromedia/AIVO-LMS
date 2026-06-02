"use server";

/**
 * Server actions for the self-service auth surfaces (`/signup`,
 * `/onboarding/signup`, `/onboarding/signin`).
 *
 * These mirror the identity-svc-backed login action in `app/login/page.tsx`
 * but are extracted into a shared module so the top-level signup page and
 * the onboarding wizard drive the SAME real registration / sign-in path —
 * the previous implementations were inert (mock redirect / `<Link>`-only
 * navigation that discarded the entered credentials).
 *
 * Mode-aware: under `AUTH_MODE=mock` (the dev default) there is no real
 * identity provider, so we preserve the legacy affordance and drop the
 * operator into the demo `/login`. In any real mode we call identity-svc,
 * set the web-v2 session cookies, and continue the funnel.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { ROLE_HOME } from "@/lib/auth/types";
import {
  identityRegister,
  identityLogin,
  extractRefreshToken,
  toSessionProfile,
} from "@/lib/auth/identity-client";
import { setAuthSessionCookies } from "@/lib/auth/session-cookies";

const EMAIL_RE = /.+@.+\..+/;

/**
 * Only allow same-origin absolute paths as a post-action destination.
 * Rejects protocol-relative (`//host`) and off-site URLs so a crafted
 * `next` field can't turn the action into an open redirect.
 */
function safePath(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

/**
 * Create a real PARENT account via identity-svc and establish the web-v2
 * session, then continue into onboarding.
 *
 * Form fields: `name`, `email`, `password`, optional `next` (post-signup
 * destination) and `errorReturn` (page to bounce back to on failure).
 */
export async function registerAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safePath(formData.get("next"), "/onboarding/parent-setup");
  const errorReturn = safePath(formData.get("errorReturn"), "/signup");

  // Mock dev mode: no identity provider is wired. Preserve the historic
  // behavior — send the operator to the demo login to pick a role.
  if (serverEnv.AUTH_MODE === "mock") {
    redirect("/login?signup=mock");
  }

  if (name.length < 2 || !EMAIL_RE.test(email) || password.length < 8) {
    redirect(`${errorReturn}?error=invalid_input`);
  }

  const result = await identityRegister({ name, email, password });

  if (result.kind === "error") {
    let code = "signup_failed";
    if (result.status === 409) code = "email_taken";
    else if (result.status === 400) code = "weak_password";
    else if (result.status === 502) code = "service_unavailable";
    redirect(`${errorReturn}?error=${code}`);
  }

  const profile = toSessionProfile(result.user);
  if (!profile) {
    redirect(`${errorReturn}?error=unsupported_role`);
  }

  const jar = await cookies();
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  redirect(next);
}

/**
 * Sign in an existing user from the onboarding wizard. Delegates MFA and
 * staff-surface redirects to the canonical `/login` flow so there is one
 * source of truth for those edge cases.
 *
 * Form fields: `email`, `password`, optional `next` and `errorReturn`.
 */
export async function onboardingSignInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safePath(formData.get("next"), "");
  const errorReturn = safePath(formData.get("errorReturn"), "/onboarding/signin");

  if (serverEnv.AUTH_MODE === "mock") {
    redirect("/login");
  }

  if (!email || !password) {
    redirect(`${errorReturn}?error=missing_credentials`);
  }

  const result = await identityLogin(email, password);

  if (result.kind === "mfa") {
    // Hand the challenge to the canonical /login/mfa screen via the same
    // short-lived httpOnly cookie it expects.
    const { MFA_CHALLENGE_COOKIE, MFA_CHALLENGE_MAX_AGE_SECONDS } =
      await import("@/lib/auth/mfa-cookies");
    const jar = await cookies();
    jar.set(
      MFA_CHALLENGE_COOKIE,
      encodeURIComponent(JSON.stringify({ token: result.mfaToken, method: result.mfaMethod })),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
      },
    );
    redirect("/login/mfa");
  }

  if (result.kind === "error") {
    if (result.status === 403 && result.redirectTo) {
      const { isSafeSurfaceRedirect } = await import("@/lib/auth/surface-redirect");
      if (isSafeSurfaceRedirect(result.redirectTo)) {
        redirect(result.redirectTo);
      }
    }
    let code: string;
    if (result.status === 401) code = "invalid_credentials";
    else if (result.status === 403) code = "wrong_surface";
    else code = "login_failed";
    redirect(`${errorReturn}?error=${code}`);
  }

  const profile = toSessionProfile(result.user);
  if (!profile) {
    redirect(`${errorReturn}?error=unsupported_role`);
  }

  const jar = await cookies();
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  redirect(next || ROLE_HOME[profile.role]);
}
