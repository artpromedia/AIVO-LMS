import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server.js";
import { InMemoryProblemSessionStore } from "../services/problem-session-store.js";

let app: FastifyInstance;
let store: InMemoryProblemSessionStore;

beforeEach(async () => {
  store = new InMemoryProblemSessionStore();
  app = await buildApp({ store, skipAuth: true });
});

afterEach(async () => {
  await app.close();
});

async function createSession(overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/problem-sessions",
    payload: {
      tenantId: "t1",
      learnerId: "l1",
      subject: "math",
      source: "baseline",
      ...overrides,
    },
  });
}

describe("problem session routes", () => {
  it("creates a problem session", async () => {
    const response = await createSession();
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.tenantId).toBe("t1");
    expect(body.status).toBe("active");
  });

  it("rejects creation without required fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/problem-sessions",
      payload: { tenantId: "t1" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("appends an event with known type", async () => {
    const created = await createSession();
    const id = created.json().id as string;
    const response = await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/events`,
      payload: { eventType: "answer_attempted", payload: { correct: true } },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().eventType).toBe("answer_attempted");
  });

  it("rejects unknown event types", async () => {
    const created = await createSession();
    const id = created.json().id as string;
    const response = await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/events`,
      payload: { eventType: "bogus_event" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("appends an attempt and increments attempt number", async () => {
    const created = await createSession();
    const id = created.json().id as string;
    const r1 = await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/attempts`,
      payload: { response: { answer: 1 }, correct: false, latencyMs: 100 },
    });
    const r2 = await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/attempts`,
      payload: { response: { answer: 2 }, correct: true, latencyMs: 200 },
    });
    expect(r1.json().attemptNumber).toBe(1);
    expect(r2.json().attemptNumber).toBe(2);
  });

  it("appends a surface snapshot", async () => {
    const created = await createSession();
    const id = created.json().id as string;
    const response = await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/snapshots`,
      payload: {
        surfaceId: "surf-1",
        snapshotType: "ink",
        snapshot: { strokes: [] },
        strokeCount: 5,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().strokeCount).toBe(5);
  });

  it("completes a session", async () => {
    const created = await createSession();
    const id = created.json().id as string;
    const response = await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/complete`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("completed");
  });

  it("returns 404 for missing session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/problem-sessions/missing-id",
    });
    expect(response.statusCode).toBe(404);
  });

  it("lists recent sessions for a learner", async () => {
    await createSession({ learnerId: "lA" });
    await createSession({ learnerId: "lA" });
    await createSession({ learnerId: "lB" });
    const response = await app.inject({
      method: "GET",
      url: "/api/problem-sessions/learner/lA/recent",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sessions).toHaveLength(2);
  });

  it("returns full session detail with events, attempts, and summary", async () => {
    const created = await createSession();
    const id = created.json().id as string;
    await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/events`,
      payload: { eventType: "surface_rendered", payload: { surfaceId: "s1" } },
    });
    await app.inject({
      method: "POST",
      url: `/api/problem-sessions/${id}/attempts`,
      payload: { response: { answer: 1 }, correct: true },
    });
    const detail = await app.inject({ method: "GET", url: `/api/problem-sessions/${id}` });
    const body = detail.json();
    expect(body.session.id).toBe(id);
    expect(body.events).toHaveLength(1);
    expect(body.attempts).toHaveLength(1);
    expect(body.summary.attempts.successRate).toBe(1);
  });
});
