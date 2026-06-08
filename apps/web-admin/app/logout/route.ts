import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearAuthSessionCookies,
  MFA_CHALLENGE_COOKIE,
} from "@aivo/admin-auth";

export const dynamic = "force-dynamic";

async function clearAndRedirect(next: string): Promise<never> {
  const jar = await cookies();
  clearAuthSessionCookies(jar);
  jar.set(MFA_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}),
  });
  redirect(next);
}

function safeNext(raw: string | null): string {
  if (!raw) return "/login";
  // Only allow same-origin relative paths to avoid open-redirect.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/login";
  return raw;
}

export async function GET(req: Request): Promise<never> {
  const url = new URL(req.url);
  await clearAndRedirect(safeNext(url.searchParams.get("next")));
}

export async function POST(req: Request): Promise<never> {
  const url = new URL(req.url);
  let next = url.searchParams.get("next");
  if (!next) {
    try {
      const form = await req.formData();
      const raw = form.get("next");
      if (typeof raw === "string") next = raw;
    } catch {
      // no form body — fall through
    }
  }
  await clearAndRedirect(safeNext(next));
}
