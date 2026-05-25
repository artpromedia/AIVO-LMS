export const locales = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  pt: "🇧🇷",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ar: "🇸🇦",
  hi: "🇮🇳",
};

export const LOCALE_COOKIE_NAME = "aivo_locale";

export function isValidLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}

/**
 * Sprint 8 — locales rendered right-to-left. Only the locales the app
 * actually ships matter for the strict `Locale` union (currently `ar`),
 * but the wider Set covers BCP-47 strings the request layer may forward
 * before validation (he / fa / ur), so a future locale addition is a
 * one-line edit here, not a cross-file search.
 */
export const RTL_LOCALES: ReadonlySet<string> = new Set([
  "ar", // Arabic — currently shipped
  "he", // Hebrew
  "fa", // Persian
  "ur", // Urdu
  "ps", // Pashto
  "sd", // Sindhi
  "yi", // Yiddish
]);

/**
 * Whether the given locale should render right-to-left.
 *
 * Accepts the strict `Locale` union AND raw strings — middleware /
 * layout consumers pass whatever `getLocale()` resolves, and we don't
 * want a TS-narrowing dance at every call site.
 */
export function isRTL(locale: string | Locale): boolean {
  // BCP-47 inputs may include a region tag ("ar-EG"). Match on the
  // primary language subtag only.
  const primary = locale.split("-")[0]?.toLowerCase() ?? locale.toLowerCase();
  return RTL_LOCALES.has(primary);
}

export type Direction = "rtl" | "ltr";
export function dirForLocale(locale: string | Locale): Direction {
  return isRTL(locale) ? "rtl" : "ltr";
}
