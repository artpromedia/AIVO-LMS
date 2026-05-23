import i18n, { init } from "i18next";
import * as Localization from "expo-localization";
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

const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi"] as const;
type Supported = (typeof SUPPORTED_LOCALES)[number];

function pickInitialLocale(): Supported {
  const code = Localization.getLocales()?.[0]?.languageCode ?? "en";
  return (SUPPORTED_LOCALES as readonly string[]).includes(code) ? (code as Supported) : "en";
}

init({
  resources,
  lng: pickInitialLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
