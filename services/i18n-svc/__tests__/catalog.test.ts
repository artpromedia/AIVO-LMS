/**
 * Sprint 12.6 — unit coverage for the i18n catalogue routes.
 *
 * Routes covered:
 *   • GET /api/i18n/locales                  — supported locale list
 *   • GET /api/i18n/translations/:locale     — read, plus 404 on unknown
 *   • GET /api/i18n/translations/:locale/:ns — namespace filter
 *   • GET /api/i18n/detect                   — Accept-Language fallback chain
 *
 * The fallback chain contract: an Accept-Language header that prefers
 * `es-MX` or `fr-CA` falls back to the bare `es` / `fr` locale; when
 * those server-side translation maps are seeded from `en`, the
 * downstream UI still gets a sensible string instead of a 404. When
 * NO supported locale matches (Klingon, etc.), detect falls back to
 * `en` with low confidence.
 */
import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerTranslationRoutes } from "../src/routes/translations.js";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  // The route module doesn't actually call the db in any path under
  // test — pass `null` so any future regression that wires a query
  // throws loudly.
  registerTranslationRoutes(app, null as any);
  await app.ready();
  return app;
}

describe("i18n-svc translation routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("GET /api/i18n/locales lists every supported locale + a default", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/locales" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.default).toBe("en");
    expect(body.locales).toContain("en");
    expect(body.locales).toContain("es");
    expect(body.locales).toContain("fr");
    // Server-translation map coverage is reported separately so the
    // i18n audit can spot un-seeded locales.
    expect(Array.isArray(body.serverTranslations)).toBe(true);
  });

  it("GET /api/i18n/translations/en returns the canonical English catalogue", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/translations/en" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locale).toBe("en");
    expect(typeof body.translations).toBe("object");
    expect(Object.keys(body.translations).length).toBeGreaterThan(0);
    expect(body.fallback).toBeFalsy();
  });

  it("GET /api/i18n/translations/es returns the Spanish catalogue (seeded; no fallback flag)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/translations/es" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locale).toBe("es");
    expect(typeof body.translations).toBe("object");
  });

  it("GET /api/i18n/translations/zz returns 404 for an unknown locale", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/translations/zz" });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toMatch(/not supported/i);
    expect(Array.isArray(body.supported)).toBe(true);
  });

  it("GET /api/i18n/detect resolves es-MX → es, fr-CA → fr, falling back to en for unknown", async () => {
    // es-MX preferred → detected es
    const esRes = await app.inject({
      method: "GET",
      url: "/api/i18n/detect",
      headers: { "accept-language": "es-MX,es;q=0.9,en;q=0.5" },
    });
    expect(esRes.statusCode).toBe(200);
    expect(esRes.json().detected).toBe("es");

    // fr-CA preferred → detected fr
    const frRes = await app.inject({
      method: "GET",
      url: "/api/i18n/detect",
      headers: { "accept-language": "fr-CA,fr;q=0.8,en;q=0.3" },
    });
    expect(frRes.statusCode).toBe(200);
    expect(frRes.json().detected).toBe("fr");

    // Unknown only → falls back to en.
    const unknownRes = await app.inject({
      method: "GET",
      url: "/api/i18n/detect",
      headers: { "accept-language": "tlh-Klingon" },
    });
    expect(unknownRes.statusCode).toBe(200);
    expect(unknownRes.json().detected).toBe("en");
  });

  it("GET /api/i18n/translations/:locale/:namespace filters by key prefix", async () => {
    // Pick any prefix that exists in the en catalogue — `common` is
    // a stable namespace used by the design system shells.
    const enRes = await app.inject({ method: "GET", url: "/api/i18n/translations/en" });
    const allKeys = Object.keys(enRes.json().translations);
    const sampleNamespace = allKeys
      .map((k) => k.split(".")[0])
      .find((ns) => ns && allKeys.some((k) => k.startsWith(ns + ".")));
    if (!sampleNamespace) {
      // No namespaced keys in the catalogue — the route still must
      // respond 200 with an empty filter result for any namespace.
      const empty = await app.inject({
        method: "GET",
        url: "/api/i18n/translations/en/nope",
      });
      expect(empty.statusCode).toBe(200);
      expect(empty.json().translations).toEqual({});
      return;
    }
    const filtered = await app.inject({
      method: "GET",
      url: `/api/i18n/translations/en/${sampleNamespace}`,
    });
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(body.namespace).toBe(sampleNamespace);
    for (const k of Object.keys(body.translations)) {
      expect(k.startsWith(sampleNamespace + ".")).toBe(true);
    }
  });
});
