/**
 * Sprint 6 (production readiness) — i18n-svc unit coverage.
 *
 * Exercises the static (DB-free) catalog + locale-detection endpoints.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/index.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("i18n-svc routes", () => {
  it("lists supported locales including English as default", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/locales" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.default).toBe("en");
    expect(body.locales).toContain("en");
    expect(body.locales).toContain("es");
  });

  it("returns translations for a supported locale", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/translations/en" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locale).toBe("en");
    expect(typeof body.translations).toBe("object");
  });

  it("404s an unsupported locale", async () => {
    const res = await app.inject({ method: "GET", url: "/api/i18n/translations/xx" });
    expect(res.statusCode).toBe(404);
    expect(res.json().supported).toBeTruthy();
  });

  it("detects locale from Accept-Language", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/i18n/detect",
      headers: { "accept-language": "fr-FR,fr;q=0.9,en;q=0.5" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().detected).toBe("fr");
  });

  it("falls back to en when Accept-Language has no supported locale", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/i18n/detect",
      headers: { "accept-language": "xx-YY" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().detected).toBe("en");
  });
});
