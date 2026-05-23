import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isValidLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";

export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    if (raw && isValidLocale(raw)) {
      locale = raw;
    }
  } catch {
    // cookies() only resolves within a request scope — fall back to default.
  }
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages, timeZone: "America/New_York" };
});
