import i18n, { init, changeLanguage } from "i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import fr from "@/i18n/fr.json";
import de from "@/i18n/de.json";
import pt from "@/i18n/pt.json";
import zh from "@/i18n/zh.json";
import ja from "@/i18n/ja.json";
import ko from "@/i18n/ko.json";
import ar from "@/i18n/ar.json";
import hi from "@/i18n/hi.json";

// AIVO supports 10 locales across web and mobile. Each non-English locale
// file is currently seeded from en.json; the `pnpm i18n:audit` script
// reports per-locale untranslated counts as the translation backlog. The
// i18next fallback (`fallbackLng: "en"`) ensures any key the translator
// hasn't reviewed yet still renders correctly while the backlog drains.
const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  ar: { translation: ar },
  hi: { translation: hi },
};

export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "zh",
  "ja",
  "ko",
  "ar",
  "hi",
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Persisted-locale key. Read by `restoreSavedLocale` at app launch and
 * written by the learner settings screen when the user picks a language.
 */
export const LOCALE_STORAGE_KEY = "aivo_locale_v1";

function pickInitialLocale(): SupportedLocale {
  const code = Localization.getLocales()?.[0]?.languageCode ?? "en";
  return (SUPPORTED_LOCALES as readonly string[]).includes(code)
    ? (code as SupportedLocale)
    : "en";
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

init({
  resources,
  lng: pickInitialLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

/**
 * Restore the locale the learner picked in settings on a previous launch.
 * Safe to call multiple times; no-ops when nothing has been persisted or
 * when the stored value is not in SUPPORTED_LOCALES.
 */
export async function restoreSavedLocale(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(raw) && raw !== i18n.language) {
      await changeLanguage(raw);
    }
  } catch {
    // AsyncStorage failures are non-fatal — fall back to the device locale.
  }
}

/**
 * Persist + apply a learner-selected locale. Both halves run in parallel
 * since neither blocks the other; failures are swallowed because the UI
 * already reflects the change optimistically.
 */
export async function setSavedLocale(locale: SupportedLocale): Promise<void> {
  await Promise.allSettled([
    AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale),
    changeLanguage(locale),
  ]);
}

export default i18n;
