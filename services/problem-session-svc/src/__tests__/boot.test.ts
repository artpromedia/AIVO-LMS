/**
 * Boot-time guard test (Sprint 12.5).
 *
 * Production must refuse to boot with the in-memory store: problem
 * sessions are durable learner work, losing them on every restart is
 * unacceptable.
 */
import { describe, expect, it, afterEach } from "vitest";
import { selectProblemSessionStore } from "../services/store-factory.js";
import {
  DrizzleProblemSessionStore,
} from "../services/drizzle-problem-session-store.js";
import { InMemoryProblemSessionStore } from "../services/problem-session-store.js";

const PRIOR_ENV = process.env.NODE_ENV;
const PRIOR_DB = process.env.DATABASE_URL;

afterEach(() => {
  process.env.NODE_ENV = PRIOR_ENV;
  if (PRIOR_DB === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = PRIOR_DB;
});

describe("problem-session-svc boot guard", () => {
  it("returns the in-memory store in non-production when no DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    const store = selectProblemSessionStore();
    expect(store).toBeInstanceOf(InMemoryProblemSessionStore);
  });

  it("hard-fails in production when DATABASE_URL is absent", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    expect(() => selectProblemSessionStore()).toThrowError(/DATABASE_URL/);
  });

  it("uses the drizzle store when DATABASE_URL is set", () => {
    process.env.NODE_ENV = "test";
    // postgres-js refuses to connect on construction so any DSN-like
    // string is enough to exercise the branch; we never query.
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    const store = selectProblemSessionStore();
    expect(store).toBeInstanceOf(DrizzleProblemSessionStore);
  });
});
