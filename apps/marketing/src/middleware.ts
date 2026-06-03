import { NextResponse, type NextRequest } from "next/server";
import { isValidLocale, LOCALE_COOKIE_NAME } from "@/i18n/config";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Locale entry point for crawlable, per-locale URLs.
 *
 * A `?lang=<locale>` query param (the URLs advertised in the hreflang
 * alternates) is honored two ways on the same request:
 *   - forwarded as an `x-aivo-locale` request header so this render resolves
 *     the locale server-side and SSRs translated content (good for crawlers);
 *   - persisted to the `aivo_locale` cookie so subsequent navigations and the
 *     client provider stay on that locale without re-passing the param.
 */
export function middleware(req: NextRequest): NextResponse {
  const lang = req.nextUrl.searchParams.get("lang");
  if (!lang || !isValidLocale(lang)) return NextResponse.next();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-aivo-locale", lang);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.cookies.set(LOCALE_COOKIE_NAME, lang, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return res;
}

export const config = {
  // Skip API routes, Next internals, and static assets; run on page routes
  // where a `?lang=` param could legitimately appear.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.).*)"],
};
