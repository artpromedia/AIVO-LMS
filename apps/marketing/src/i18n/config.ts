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

export function getStoredLocale(): Locale | null {
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
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage access can throw in SSR / privacy modes — non-fatal.
  }
}
