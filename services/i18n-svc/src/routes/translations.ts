import { FastifyInstance } from "fastify";
import { en } from "../translations/en.js";
import { es } from "../translations/es.js";
import {
  listLocalesSchema,
  getTranslationsSchema,
  getNamespaceTranslationsSchema,
  detectLocaleSchema,
  getLocalizedContentSchema,
} from "./schemas.js";

const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi"];

const TRANSLATIONS: Record<string, Record<string, string>> = { en, es };

export function registerTranslationRoutes(app: FastifyInstance, db: any) {
  app.get("/api/i18n/locales", { schema: listLocalesSchema }, async () => {
    return {
      locales: SUPPORTED_LOCALES,
      default: "en",
      available: SUPPORTED_LOCALES,
      serverTranslations: Object.keys(TRANSLATIONS),
      note: "All 10 locales are available via frontend JSON files. Server-side translations available for: " + Object.keys(TRANSLATIONS).join(", "),
      names: {
        en: "English", es: "Español", fr: "Français", de: "Deutsch",
        pt: "Português", zh: "中文", ja: "日本語", ko: "한국어",
        ar: "العربية", hi: "हिन्दी",
      },
    };
  });

  app.get("/api/i18n/translations/:locale", { schema: getTranslationsSchema }, async (request, reply) => {
    const { locale } = request.params as any;
    if (!SUPPORTED_LOCALES.includes(locale)) {
      return reply.code(404).send({ error: "Locale not supported", supported: SUPPORTED_LOCALES });
    }
    return { locale, translations: TRANSLATIONS[locale] || TRANSLATIONS.en, fallback: !TRANSLATIONS[locale] };
  });

  app.get("/api/i18n/translations/:locale/:namespace", { schema: getNamespaceTranslationsSchema }, async (request, reply) => {
    const { locale, namespace } = request.params as any;
    const all = TRANSLATIONS[locale] || TRANSLATIONS.en;
    const filtered: Record<string, string> = {};
    for (const [key, val] of Object.entries(all)) {
      if (key.startsWith(namespace + ".")) filtered[key] = val;
    }
    return { locale, namespace, translations: filtered };
  });

  app.get("/api/i18n/detect", { schema: detectLocaleSchema }, async (request) => {
    const acceptLang = (request.headers["accept-language"] || "en") as string;
    const parsed = acceptLang.split(",").map((part) => {
      const [lang, q] = part.trim().split(";q=");
      return { locale: lang.split("-")[0].toLowerCase(), quality: q ? parseFloat(q) : 1.0 };
    }).sort((a, b) => b.quality - a.quality);

    const detected = parsed.find((p) => SUPPORTED_LOCALES.includes(p.locale));
    return {
      detected: detected?.locale || "en",
      confidence: detected ? detected.quality : 0.5,
      source: "accept-language",
      alternatives: parsed
        .filter((p) => SUPPORTED_LOCALES.includes(p.locale) && p.locale !== detected?.locale)
        .slice(0, 3)
        .map((p) => ({ locale: p.locale, confidence: p.quality })),
    };
  });

  app.get("/api/i18n/content/:contentId/:locale", { schema: getLocalizedContentSchema }, async (request, reply) => {
    const { contentId, locale } = request.params as any;
    return { contentId, locale, status: "original", content: null };
  });
}
