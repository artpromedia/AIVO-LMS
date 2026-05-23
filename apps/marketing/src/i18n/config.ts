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
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${LOCALE_COOKIE_NAME}=`));
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
