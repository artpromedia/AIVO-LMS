import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isValidLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";
import { resolveTimeZone } from "./timezone";
import { getSession } from "@/lib/auth/session";

export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale;
  let timeZone = resolveTimeZone(null);
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    if (raw && isValidLocale(raw)) {
      locale = raw;
    }
    // Sprint A8 — every next-intl date/time renders in the VIEWER's zone
    // (stored on the profile; auto-synced once by <TzSync/>), not a
    // hardcoded US-East default. Anonymous visitors get UTC.
    const session = await getSession();
    timeZone = resolveTimeZone(session?.timezone);
  } catch {
    // cookies()/session only resolve within a request scope — defaults hold.
  }
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages, timeZone };
});
