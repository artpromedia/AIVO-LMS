import { NextResponse } from "next/server";
import {
  SENSORY_MODE_COOKIE,
  SENSORY_MODE_COOKIE_MAX_AGE,
  resolveSensoryMode,
} from "@/lib/sensory-mode";

/**
 * Persist the visitor's sensory-mode choice in a cookie so the root layout
 * can apply `data-sensory-mode` on the next request — no flash of unstyled
 * content on subsequent navigations.
 *
 * Body: { "mode": "standard" | "calm" | "high-contrast" }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = resolveSensoryMode(
    typeof body === "object" && body !== null && "mode" in body
      ? String((body as { mode: unknown }).mode)
      : null,
  );

  const res = NextResponse.json({ mode });
  res.cookies.set(SENSORY_MODE_COOKIE, mode, {
    path: "/",
    maxAge: SENSORY_MODE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
