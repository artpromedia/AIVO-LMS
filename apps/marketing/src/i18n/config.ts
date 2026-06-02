export const locales = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// Sprint 8 — RTL helpers, mirrored from apps/web-v2/lib/i18n/config.ts
// so marketing's <html dir> stays in sync.
export const RTL_LOCALES: ReadonlySet<string> = new Set(["ar", "he", "fa", "ur", "ps", "sd", "yi"]);

export type Direction = "rtl" | "ltr";

export function isRTL(locale: string | Locale): boolean {
  const primary = locale.split("-")[0]?.toLowerCase() ?? locale.toLowerCase();
  return RTL_LOCALES.has(primary);
}

export function dirForLocale(locale: string | Locale): Direction {
  return isRTL(locale) ? "rtl" : "ltr";
}

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

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;
  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    const base = lang.split("-")[0].toLowerCase();
    if (isValidLocale(base)) return base;
  }
  return defaultLocale;
}

const LOCALE_STORAGE_KEY = "aivo_locale";
export const LOCALE_COOKIE_NAME = "aivo_locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE_NAME}=`));
    if (!match) return null;
    const value = decodeURIComponent(match.split("=")[1] ?? "");
    if (value && isValidLocale(value)) return value;
  } catch {
    // ignore
  }
  return null;
}

function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // ignore
  }
}

export function getStoredLocale(): Locale | null {
  // Cookie wins so server + client agree on first render after navigation.
  const fromCookie = readLocaleCookie();
  if (fromCookie) return fromCookie;
  if (typeof localStorage === "undefined") return null;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isValidLocale(stored)) return stored;
  } catch {
    // Storage access can throw in SSR / privacy modes — fall through.
  }
  return null;
}

export function setStoredLocale(locale: Locale): void {
  writeLocaleCookie(locale);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage access can throw in SSR / privacy modes — non-fatal.
  }
}
