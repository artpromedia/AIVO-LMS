/**
 * Sprint 6 (production readiness) — status-page-svc unit coverage.
 *
 * status-page-svc is stateless, so these run with no DB / no broker.
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

describe("status-page-svc routes", () => {
  it("health responds ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/status/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBeTruthy();
  });

  it("incidents list is shaped as { incidents, total }", async () => {
    const res = await app.inject({ method: "GET", url: "/api/status/incidents" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.incidents)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("uptime reports an overall figure and per-service breakdown", async () => {
    const res = await app.inject({ method: "GET", url: "/api/status/uptime" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.uptime.overall).toBe("number");
    expect(Array.isArray(body.uptime.byService)).toBe(true);
  });

  it("creating an incident requires admin (rejects anonymous)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/status/incidents",
      payload: { title: "x", description: "y", severity: "minor" },
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it("unknown service returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/status/service/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });
});
