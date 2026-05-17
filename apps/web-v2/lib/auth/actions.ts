"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MOCK_COOKIE_NAME } from "@/lib/auth/mock-session";

/**
 * Server action invoked from <form action={logoutAction}> in the app shell.
 * Server actions deliberately sit outside the BFF envelope contract — they
 * are RSC-internal endpoints, not part of the JSON API. The JSON-API
 * counterpart is `POST /api/bff/auth/mock-login` for sign-in; sign-out from
 * JSON clients should call this action via the form post or implement a
 * future `POST /api/bff/auth/logout` returning the standard envelope.
 */
export async function logoutAction() {
  const jar = await cookies();
  jar.set(MOCK_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  redirect("/login");
}
