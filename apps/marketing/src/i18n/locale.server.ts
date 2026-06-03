import { cookies, headers } from "next/headers";
import { defaultLocale, isValidLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";

/**
 * Resolve the active locale for a server render. Precedence:
 *   1. `x-aivo-locale` request header (set by middleware from a `?lang=` URL
 *      param on the very first hit, before the cookie round-trips).
 *   2. The persisted `aivo_locale` cookie.
 *   3. The default locale.
 *
 * Used by both the root layout (to SSR translated content + the correct
 * <html lang>) and the next-intl request config, so the two never diverge.
 */
export async function resolveServerLocale(): Promise<Locale> {
  try {
    const hdr = (await headers()).get("x-aivo-locale");
    if (hdr && isValidLocale(hdr)) return hdr;
  } catch {
    // headers() is only available within a request scope — fall through.
  }
  try {
    const raw = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
    if (raw && isValidLocale(raw)) return raw;
  } catch {
    // cookies() is only available within a request scope — fall through.
  }
  return defaultLocale;
}

/** Load a locale's message bundle on the server (for SSR of translated copy). */
export async function loadServerMessages(locale: Locale): Promise<Record<string, unknown>> {
  try {
    return (await import(`./messages/${locale}.json`)).default;
  } catch {
    return (await import(`./messages/${defaultLocale}.json`)).default;
  }
}
