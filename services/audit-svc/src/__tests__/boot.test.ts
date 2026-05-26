/**
 * Boot-time guard test (Sprint 12.5).
 *
 * Production must refuse to boot with the in-memory store: audit events
 * are tamper-evident compliance records.
 */
import { describe, expect, it, afterEach } from "vitest";
import { selectAuditStore } from "../services/store-factory.js";
import { DrizzleAuditStore } from "../services/drizzle-audit-store.js";
import { InMemoryAuditStore } from "../services/audit-store.js";

const PRIOR_ENV = process.env.NODE_ENV;
const PRIOR_DB = process.env.DATABASE_URL;

afterEach(() => {
  process.env.NODE_ENV = PRIOR_ENV;
  if (PRIOR_DB === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = PRIOR_DB;
});

describe("audit-svc boot guard", () => {
  it("returns the in-memory store in non-production when no DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    const store = selectAuditStore();
    expect(store).toBeInstanceOf(InMemoryAuditStore);
  });

  it("hard-fails in production when DATABASE_URL is absent", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    expect(() => selectAuditStore()).toThrowError(/DATABASE_URL/);
  });

  it("uses the drizzle store when DATABASE_URL is set", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    const store = selectAuditStore();
    expect(store).toBeInstanceOf(DrizzleAuditStore);
  });
});
