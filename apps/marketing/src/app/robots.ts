import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

/**
 * Paths that stay out of every crawler — auth flows and the API surface.
 * Applied identically to the wildcard group and every named AI crawler so
 * there is one source of truth for what is off-limits.
 */
export const DISALLOWED_PATHS = ["/api/", "/login", "/signup"];

/**
 * Generative-engine and AI crawlers we explicitly name so the marketing
 * site is legible and permission-clear to the answer engines that cite it
 * (ChatGPT, Perplexity, Claude, Google AI Overviews / Gemini, Apple, etc.).
 *
 * Every bot here is allowed to crawl content but still denied the
 * DISALLOWED_PATHS. Driven from this exported const array so the rule set is
 * testable and easy to amend without touching the handler below.
 */
export const AI_CRAWLERS = [
  // OpenAI — GPTBot trains/grounds ChatGPT, OAI-SearchBot powers ChatGPT
  // search, ChatGPT-User is the live user-triggered fetch.
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic — Claude training + live retrieval.
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  // Perplexity answer engine.
  "PerplexityBot",
  // Google — gates Gemini / AI Overviews use of our content.
  "Google-Extended",
  // Other major AI crawlers. We choose to allow content (we want to be
  // citable) while denying the same auth/API paths as everyone else.
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "CCBot",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      // One distinct group per named AI crawler. Same allow/deny shape as the
      // wildcard group today, but naming them makes our stance explicit and
      // gives us a per-bot knob if policy ever diverges.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
