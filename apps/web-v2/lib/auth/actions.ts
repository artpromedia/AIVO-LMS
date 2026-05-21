"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MOCK_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/mock-session";
import { serverEnv } from "@/lib/env";

/**
 * Server action invoked from <form action={logoutAction}> in the app shell.
 * Server actions deliberately sit outside the BFF envelope contract — they
 * are RSC-internal endpoints, not part of the JSON API. The JSON-API
 * counterpart is `POST /api/bff/auth/mock-login` for sign-in; sign-out from
 * JSON clients should call this action via the form post or implement a
 * future `POST /api/bff/auth/logout` returning the standard envelope.
 *
 * Mode-aware: clears the appropriate cookies for mock vs real auth, and
 * best-effort invalidates the refresh-token row in identity-svc.
 */
export async function logoutAction() {
  const jar = await cookies();
  // Always clear the mock cookie so a former dev login can't linger.
  jar.set(MOCK_COOKIE_NAME, "", { path: "/", maxAge: 0 });

  if (serverEnv.AUTH_MODE !== "mock") {
    const {
      identityLogout,
      IDENTITY_ACCESS_TOKEN_COOKIE,
      IDENTITY_REFRESH_TOKEN_COOKIE,
    } = await import("@/lib/auth/identity-client");
    const refresh = jar.get(IDENTITY_REFRESH_TOKEN_COOKIE)?.value ?? null;
    await identityLogout(refresh);
    jar.set(IDENTITY_ACCESS_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    jar.set(IDENTITY_REFRESH_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
    jar.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  }

  redirect("/login");
}

