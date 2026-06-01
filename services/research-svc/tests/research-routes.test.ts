/**
 * Sprint 6 (production readiness) — research-svc unit coverage.
 *
 * The analytics endpoints all require research access, so without a DB we
 * verify health plus that the auth gate is enforced (anonymous → 401).
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

describe("research-svc routes", () => {
  it("health responds ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/research/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().service).toBe("research-svc");
  });

  it("rejects anonymous access to cohort analytics", async () => {
    const res = await app.inject({ method: "GET", url: "/api/research/cohorts" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/research/cohorts",
      headers: { authorization: "Bearer not-a-real-jwt" },
    });
    expect(res.statusCode).toBe(401);
  });
});
