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
import { ROLE_HOME, type Role } from "@/lib/auth/types";
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
 * Self-serve roles that may be created through the public signup form.
 * Kept in lockstep with the signup page's role branch and the identity-svc
 * `/api/auth/register` enum. A tampered `role` field falls back to PARENT so
 * a crafted request can't escalate into an unsupported/privileged role.
 */
const SELF_SERVE_ROLES = new Set(["PARENT", "TEACHER", "SCHOOL_ADMIN", "DISTRICT_ADMIN"]);
type SelfServeRole = "PARENT" | "TEACHER" | "SCHOOL_ADMIN" | "DISTRICT_ADMIN";

function safeRole(value: FormDataEntryValue | null): SelfServeRole {
  if (typeof value === "string" && SELF_SERVE_ROLES.has(value)) {
    return value as SelfServeRole;
  }
  return "PARENT";
}

/**
 * Create a real account via identity-svc with the persona the user picked
 * (parent / teacher / school admin / district admin), establish the web-v2
 * session, then continue into the matching onboarding flow.
 *
 * Form fields: `name`, `email`, `password`, `role` (self-serve persona),
 * optional `next` (post-signup destination) and `errorReturn` (page to
 * bounce back to on failure).
 */
export async function registerAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = safeRole(formData.get("role"));
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

  const result = await identityRegister({ name, email, password, role });

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

/**
 * Canonical sign-in for the main `/login` page — the action most returning
 * users hit. Owns the friendly error-code mapping (identity-svc failure
 * status → `?error=` code), the MFA challenge handoff, the safe-surface 403
 * redirect (with an unsafe-redirect fallback), the unsupported-role case,
 * and the successful redirect to the role home. `onboardingSignInAction`
 * mirrors this for the wizard; keep the two in sync.
 *
 * Form fields: `email`, `password` (real mode) or `role` (mock dev mode).
 */
export async function loginAction(formData: FormData): Promise<void> {
  // Development path: developer affordance, identical to the previous
  // behavior so AUTH_MODE=mock workflows keep working.
  if (serverEnv.AUTH_MODE === "mock") {
    const { MOCK_USERS, MOCK_COOKIE_NAME } = await import("@/lib/auth/mock-session");
    const raw = formData.get("role");
    const role = (typeof raw === "string" ? raw : "parent") as Role;
    if (!(role in MOCK_USERS)) {
      redirect("/login?error=invalid_role");
    }
    const jar = await cookies();
    jar.set(MOCK_COOKIE_NAME, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect(ROLE_HOME[role]);
  }

  // Real path: services/identity-svc.
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/login?error=missing_credentials");
  }

  const result = await identityLogin(email, password);

  if (result.kind === "mfa") {
    // Stash the mfaToken in a short-lived httpOnly cookie instead of the
    // URL so the bearer credential never appears in browser history,
    // server logs, or the Referer header. /login/mfa reads it back.
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
    // 403 + redirectTo: identity-svc is telling us the user belongs on a
    // different portal (admin / district). Forward them straight there
    // instead of stranding them on the consumer login with an opaque error.
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
    redirect(`/login?error=${code}`);
  }

  const profile = toSessionProfile(result.user);
  if (!profile) {
    redirect("/login?error=unsupported_role");
  }

  const jar = await cookies();
  setAuthSessionCookies(jar, {
    accessToken: result.accessToken,
    refreshToken: extractRefreshToken(result.setCookies),
    profile,
  });

  redirect(ROLE_HOME[profile.role]);
}
