/**
 * Sprint 12.6 — health-aggregation contract for status-page-svc.
 *
 * The /api/status/overview route aggregates per-service health probes
 * into a single `overall` string. The mapping rule (see
 * src/routes/status.ts, the `anyDown ? major_outage : allHealthy ? operational :
 * degraded` branch) is the user-facing contract that the public status
 * page depends on, so it gets its own unit-level fixture independent
 * of the live fetch path.
 *
 * Rule, in terms the task prompt uses:
 *   • all healthy ("green")          → operational
 *   • any down ("red")               → major_outage
 *   • one degraded / unknown but
 *     no down                        → degraded (i.e. "yellow")
 *
 * To keep the test hermetic we mock `fetch` and exercise the actual
 * route — that proves both the per-service classifier (res.ok →
 * healthy, !res.ok → degraded, throw → down) and the overall
 * aggregator behave together.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

type Outcome = "ok" | "error" | "throw";

function makeFetchMock(outcomesByUrl: (url: string) => Outcome) {
  return vi.fn(async (url: string) => {
    const outcome = outcomesByUrl(url);
    if (outcome === "throw") throw new Error(`mock fetch refused for ${url}`);
    if (outcome === "error") return { ok: false, status: 503 } as any;
    return { ok: true, status: 200 } as any;
  });
}

async function buildAppWithMockedFetch(outcomes: (url: string) => Outcome) {
  // Install the fetch mock BEFORE importing the route module — the
  // module captures `fetch` via the global, so the mock must be in
  // place at import time on a fresh module cache.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeFetchMock(outcomes) as any;
  vi.resetModules();
  const { registerStatusRoutes } = await import("../src/routes/status.js");
  const app = Fastify({ logger: false });
  registerStatusRoutes(app);
  await app.ready();
  return {
    app,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

describe("status-page-svc health aggregation", () => {
  let harness: { app: FastifyInstance; restore: () => void } | null = null;

  afterEach(async () => {
    if (harness) {
      await harness.app.close();
      harness.restore();
      harness = null;
    }
  });

  it("all services healthy → overall: operational (green)", async () => {
    harness = await buildAppWithMockedFetch(() => "ok");
    const res = await harness.app.inject({ method: "GET", url: "/api/status/overview" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.overall).toBe("operational");
    expect(Array.isArray(body.services)).toBe(true);
    for (const s of body.services) expect(s.status).toBe("healthy");
  });

  it("one service degraded (non-2xx) but none down → overall: degraded (yellow)", async () => {
    harness = await buildAppWithMockedFetch((url) =>
      url.includes("3007") ? "error" : "ok",
    );
    const res = await harness.app.inject({ method: "GET", url: "/api/status/overview" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.overall).toBe("degraded");
    const degraded = body.services.filter((s: any) => s.status === "degraded");
    expect(degraded.length).toBe(1);
  });

  it("one service down (network throw) → overall: major_outage (red)", async () => {
    harness = await buildAppWithMockedFetch((url) =>
      url.includes("3001") ? "throw" : "ok",
    );
    const res = await harness.app.inject({ method: "GET", url: "/api/status/overview" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.overall).toBe("major_outage");
    const down = body.services.filter((s: any) => s.status === "down");
    expect(down.length).toBe(1);
  });

  it("mixed: one down + one degraded → still major_outage (red dominates yellow)", async () => {
    harness = await buildAppWithMockedFetch((url) => {
      if (url.includes("3001")) return "throw";
      if (url.includes("3007")) return "error";
      return "ok";
    });
    const res = await harness.app.inject({ method: "GET", url: "/api/status/overview" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.overall).toBe("major_outage");
  });

  it("unknown / unreachable services are treated as 'down' (red, not silently green)", async () => {
    // An unreachable service throws — the per-service classifier maps
    // that to `down`. This guards against the regression where a
    // misconfigured BASE_URL would 404 quietly and the overall stayed
    // operational.
    harness = await buildAppWithMockedFetch(() => "throw");
    const res = await harness.app.inject({ method: "GET", url: "/api/status/overview" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.overall).toBe("major_outage");
    for (const s of body.services) expect(s.status).toBe("down");
  });

  it("GET /api/status/service/:name returns 404 for an unknown service id", async () => {
    harness = await buildAppWithMockedFetch(() => "ok");
    const res = await harness.app.inject({
      method: "GET",
      url: "/api/status/service/nonexistent-svc",
    });
    expect(res.statusCode).toBe(404);
  });
});
