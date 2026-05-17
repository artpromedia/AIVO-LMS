/**
 * Per-route Fastify JSON Schema definitions for `i18n-svc`.
 * See `services/learning-svc/src/routes/schemas.ts` for the 5.2 reference.
 */

const errorResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: { error: { type: "string" } },
} as const;

const localeNotSupportedResponse = {
  type: "object",
  required: ["error"],
  additionalProperties: true,
  properties: {
    error: { type: "string" },
    supported: { type: "array", items: { type: "string" } },
  },
} as const;

const translationsMap = {
  type: "object",
  additionalProperties: { type: "string" },
} as const;

export const listLocalesSchema = {
  tags: ["I18n"],
  operationId: "listLocales",
  summary: "List supported locales and human-readable names",
  response: {
    200: {
      type: "object",
      required: ["locales", "default", "available"],
      additionalProperties: true,
      properties: {
        locales: { type: "array", items: { type: "string" } },
        default: { type: "string" },
        available: { type: "array", items: { type: "string" } },
        serverTranslations: { type: "array", items: { type: "string" } },
        note: { type: "string" },
        names: { type: "object", additionalProperties: { type: "string" } },
      },
    },
  },
} as const;

export const getTranslationsSchema = {
  tags: ["I18n"],
  operationId: "getTranslations",
  summary: "Get all translation keys for a locale",
  params: {
    type: "object",
    required: ["locale"],
    additionalProperties: true,
    properties: { locale: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      required: ["locale", "translations", "fallback"],
      additionalProperties: true,
      properties: {
        locale: { type: "string" },
        translations: translationsMap,
        fallback: { type: "boolean" },
      },
    },
    404: localeNotSupportedResponse,
  },
} as const;

export const getNamespaceTranslationsSchema = {
  tags: ["I18n"],
  operationId: "getNamespaceTranslations",
  summary: "Get translations scoped to a specific namespace",
  params: {
    type: "object",
    required: ["locale", "namespace"],
    additionalProperties: true,
    properties: {
      locale: { type: "string" },
      namespace: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["locale", "namespace", "translations"],
      additionalProperties: true,
      properties: {
        locale: { type: "string" },
        namespace: { type: "string" },
        translations: translationsMap,
      },
    },
  },
} as const;

export const detectLocaleSchema = {
  tags: ["I18n"],
  operationId: "detectLocale",
  summary: "Detect best-matching locale from the Accept-Language header",
  response: {
    200: {
      type: "object",
      required: ["detected", "confidence", "source"],
      additionalProperties: true,
      properties: {
        detected: { type: "string" },
        confidence: { type: "number" },
        source: { type: "string" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              locale: { type: "string" },
              confidence: { type: "number" },
            },
          },
        },
      },
    },
  },
} as const;

export const getLocalizedContentSchema = {
  tags: ["I18n"],
  operationId: "getLocalizedContent",
  summary: "Look up a localized content payload for a given content id",
  params: {
    type: "object",
    required: ["contentId", "locale"],
    additionalProperties: true,
    properties: {
      contentId: { type: "string" },
      locale: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["contentId", "locale", "status"],
      additionalProperties: true,
      properties: {
        contentId: { type: "string" },
        locale: { type: "string" },
        status: { type: "string" },
        content: { type: ["object", "null"], additionalProperties: true },
      },
    },
  },
} as const;

const healthResponseSchema = {
  type: "object",
  required: ["status", "service", "timestamp"],
  additionalProperties: true,
  properties: {
    status: { type: "string" },
    service: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

export const healthSchema = {
  tags: ["Health"],
  operationId: "i18nHealth",
  summary: "Service health probe",
  response: { 200: healthResponseSchema },
} as const;
