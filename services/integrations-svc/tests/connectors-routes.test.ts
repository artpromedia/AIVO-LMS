/**
 * Sprint 6 (production readiness) — integrations-svc unit coverage.
 *
 * The connector catalogue is static, so it is testable without a DB. We also
 * assert the waitlist mutation enforces auth.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/index.js";

let app: FastifyInstance;

beforeAll(async () => {
  // Pass a stub db: the catalogue routes under test never touch it.
  app = await buildApp({} as any);
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("integrations-svc connector catalogue", () => {
  it("lists the connector catalogue", async () => {
    const res = await app.inject({ method: "GET", url: "/api/integrations/connectors" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const connectors = body.connectors ?? body;
    const ids = (connectors as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toContain("google_classroom");
    expect(ids).toContain("clever");
  });

  it("marks Schoology / PowerSchool with a status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/integrations/connectors" });
    const body = res.json();
    const connectors = (body.connectors ?? body) as Array<{ id: string; status: string }>;
    const schoology = connectors.find((c) => c.id === "schoology");
    expect(schoology).toBeTruthy();
    expect(typeof schoology!.status).toBe("string");
  });

  it("rejects anonymous waitlist signup", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/integrations/waitlist",
      payload: { connectorId: "schoology", contactEmail: "a@b.com" },
    });
    expect([401, 403]).toContain(res.statusCode);
  });
});
