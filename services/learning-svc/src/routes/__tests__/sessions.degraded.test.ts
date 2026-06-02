/**
 * Sprint 0 — Guardrails & Observability.
 *
 * Verifies that the four downstream helpers in sessions.ts no longer
 * silently swallow failures and instead:
 *   - log + increment the prom counter
 *   - report the failed subsystem on a DegradationTracker
 *   - degrade gracefully (soft subsystems) or fail closed (brain-svc)
 *     according to LEARNING_SVC_FAIL_OPEN.
 */

// ── Env wiring (must be set before importing the route module) ─────────

process.env.NODE_ENV = "test";
process.env.BRAIN_SVC_URL = "http://brain.test.invalid";
process.env.SUBJECT_BRAIN_SVC_URL = "http://subject-brain.test.invalid";
process.env.PROBLEM_SESSION_SVC_URL = "http://problem-session.test.invalid";
process.env.RESPONSIBLE_AI_SVC_URL = "http://responsible-ai.test.invalid";
process.env.AIVO_FEATURE_ADVANCED_CONTENT_GENERATORS = "true";
process.env.AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS = "true";
process.env.AIVO_FEATURE_PROBLEM_SESSION_LEDGER = "true";
process.env.AIVO_ALLOW_UNGATED_TUTORS = "true";
process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";

import { describe, it, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { exportMetrics } from "@aivo/observability";

type FetchFn = typeof fetch;
const originalFetch: FetchFn = globalThis.fetch;

function installFetchStub(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response> | Error,
) {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : (input?.url ?? String(input));
    const out = await handler(url, init);
    if (out instanceof Error) throw out;
    return out;
  }) as FetchFn;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const LEARNER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_ID = "00000000-0000-0000-0000-000000000000";
const TUTOR_SKU = "ADDON_TUTOR_MATH";

const INTERNAL_HEADERS = {
  "x-internal-service": "learning-svc-test",
  "x-service-token": "test-internal-token",
  "content-type": "application/json",
} as const;

function makeDb() {
  return {
    select() {
      return {
        from: () => ({
          where: async () => [{ tenantId: TENANT_ID }],
        }),
      };
    },
    insert() {
      let row: any = null;
      return {
        values(v: any) {
          row = { id: "test-session-1", ...v };
          return { returning: async () => [row] };
        },
      };
    },
    update() {
      return {
        set() {
          return { where: async () => undefined };
        },
      };
    },
  } as any;
}

let registerSessionRoutes: (app: FastifyInstance, db: any) => void;

before(async () => {
  ({ registerSessionRoutes } = await import("../sessions.js"));
});

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerSessionRoutes(app, makeDb());
  await app.ready();
  return app;
}

function metricCount(service: string): number {
  const text = exportMetrics();
  const re = new RegExp(
    `learning_svc_downstream_failures_total\\{[^}]*service="${service}"[^}]*\\}\\s+(\\d+(?:\\.\\d+)?)`,
    "g",
  );
  let total = 0;
  for (const m of text.matchAll(re)) total += Number(m[1]);
  return total;
}

describe("learning-svc downstream guardrails (Sprint 0)", () => {
  beforeEach(() => {
    delete process.env.LEARNING_SVC_FAIL_OPEN;
  });
  afterEach(() => {
    restoreFetch();
  });

  it("brain-svc outage with fail-closed returns 503 DegradedResponse", async () => {
    process.env.LEARNING_SVC_FAIL_OPEN = "false";
    const before = metricCount("brain-svc");
    installFetchStub((url) => {
      if (url.includes("/api/brain/")) return new Error("ECONNREFUSED");
      return jsonResponse({});
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/learning/sessions",
        headers: INTERNAL_HEADERS,
        payload: { learnerId: LEARNER_ID, tutorSku: TUTOR_SKU, topic: "fractions" },
      });
      assert.equal(res.statusCode, 503, res.payload);
      const body = res.json() as {
        degraded: boolean;
        degradedSubsystems: string[];
        error: string;
      };
      assert.equal(body.degraded, true);
      assert.ok(body.degradedSubsystems.includes("brain-svc"));
      assert.ok(typeof body.error === "string" && body.error.length > 0);
    } finally {
      await app.close();
    }

    assert.ok(metricCount("brain-svc") > before, "expected brain-svc failure counter to increment");
  });

  it("brain-svc outage with fail-open does not return typed degraded 503", async () => {
    process.env.LEARNING_SVC_FAIL_OPEN = "true";
    installFetchStub((url) => {
      if (url.includes("/api/brain/")) return new Error("ECONNREFUSED");
      return jsonResponse({});
    });

    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/learning/sessions",
        headers: INTERNAL_HEADERS,
        payload: { learnerId: LEARNER_ID, tutorSku: TUTOR_SKU, topic: "fractions" },
      });
      if (res.statusCode === 503) {
        const body = res.json() as { degraded?: boolean };
        assert.notEqual(body.degraded, true, res.payload);
      }
    } finally {
      await app.close();
    }
  });

  it("subject-brain-svc failure increments counter", async () => {
    process.env.LEARNING_SVC_FAIL_OPEN = "true";
    const before = metricCount("subject-brain-svc");
    installFetchStub((url) => {
      if (url.includes("/api/brain/")) return jsonResponse({ state: {} });
      if (url.includes("/api/subject-brain/")) return new Response("boom", { status: 500 });
      return jsonResponse({});
    });
    const app = await buildApp();
    try {
      await app.inject({
        method: "POST",
        url: "/api/learning/sessions",
        headers: INTERNAL_HEADERS,
        payload: { learnerId: LEARNER_ID, tutorSku: TUTOR_SKU, topic: "fractions" },
      });
    } finally {
      await app.close();
    }
    assert.ok(
      metricCount("subject-brain-svc") > before,
      "expected subject-brain-svc failure counter to increment",
    );
  });

  it("responsible-ai-svc failure increments counter", async () => {
    process.env.LEARNING_SVC_FAIL_OPEN = "true";
    const before = metricCount("responsible-ai-svc");
    installFetchStub((url) => {
      if (url.includes("/api/brain/")) return jsonResponse({ state: {} });
      if (url.includes("/api/subject-brain/")) return jsonResponse({ recommendedSurfaces: [] });
      if (url.includes("/api/responsible-ai/")) return new Error("timeout");
      return jsonResponse({});
    });
    const app = await buildApp();
    try {
      await app.inject({
        method: "POST",
        url: "/api/learning/sessions",
        headers: INTERNAL_HEADERS,
        payload: { learnerId: LEARNER_ID, tutorSku: TUTOR_SKU, topic: "fractions" },
      });
    } finally {
      await app.close();
    }
    assert.ok(
      metricCount("responsible-ai-svc") > before,
      "expected responsible-ai-svc failure counter to increment",
    );
  });

  it("problem-session-svc failure increments counter (fire-and-forget)", async () => {
    process.env.LEARNING_SVC_FAIL_OPEN = "true";
    const before = metricCount("problem-session-svc");
    installFetchStub((url) => {
      if (url.includes("/api/brain/")) return jsonResponse({ state: {} });
      if (url.includes("/api/subject-brain/")) return jsonResponse({});
      if (url.includes("/api/responsible-ai/")) {
        return jsonResponse({ allowed: true, severity: "none", recommendedAction: "allow" });
      }
      if (url.includes("/api/problem-sessions")) return new Error("ECONNRESET");
      return jsonResponse({});
    });
    const app = await buildApp();
    try {
      await app.inject({
        method: "POST",
        url: "/api/learning/sessions",
        headers: INTERNAL_HEADERS,
        payload: { learnerId: LEARNER_ID, tutorSku: TUTOR_SKU, topic: "fractions" },
      });
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      await app.close();
    }
    assert.ok(
      metricCount("problem-session-svc") > before,
      "expected problem-session-svc failure counter to increment",
    );
  });
});
