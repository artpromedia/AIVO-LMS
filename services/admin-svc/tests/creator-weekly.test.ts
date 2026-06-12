/**
 * Remediation Sprint 06 — the Sunday-night Creator job (admin-svc side).
 *
 * Self-contained: fake db (tenant enumeration) + injected fetch, so the test
 * proves the tenant fan-out, auth header, batching, and JobOutcome mapping
 * without Postgres or a running web-v2.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listActiveTenantIds, runCreatorWeeklyOnce } from "../src/lib/creator-weekly.js";

function fakeDb(tenantIds: string[]) {
  return {
    async execute() {
      return { rows: tenantIds.map((tenant_id) => ({ tenant_id })) };
    },
  };
}

describe("creator.weekly-generation runner", () => {
  it("enumerates tenants from the learners table", async () => {
    const ids = await listActiveTenantIds(fakeDb(["t_a", "t_b"]));
    assert.deepEqual(ids, ["t_a", "t_b"]);
  });

  it("POSTs each tenant batch to web-v2 with the service token and maps counts", async () => {
    const calls: Array<{ url: string; token: string | null; body: unknown }> = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        token: (init?.headers as Record<string, string>)["x-service-token"] ?? null,
        body: JSON.parse(String(init?.body)),
      });
      return new Response(
        JSON.stringify({ ok: true, data: { generated: 3, failed: 0 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const outcome = await runCreatorWeeklyOnce(fakeDb(["t_a", "t_b"]), {
      fetchImpl,
      webV2InternalUrl: "http://web:5000",
      internalServiceToken: "tok-123",
    });
    assert.equal(outcome.status, "ok");
    assert.equal(outcome.sent, 3);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://web:5000/api/internal/creator/pregenerate");
    assert.equal(calls[0].token, "tok-123");
    assert.deepEqual((calls[0].body as { tenantIds: string[] }).tenantIds, ["t_a", "t_b"]);
  });

  it("fails closed without the internal URL/token instead of pretending to run", async () => {
    const outcome = await runCreatorWeeklyOnce(fakeDb(["t_a"]), {
      webV2InternalUrl: undefined,
      internalServiceToken: undefined,
      fetchImpl: (async () => {
        throw new Error("must not be called");
      }) as typeof fetch,
    });
    assert.equal(outcome.status, "failed");
  });

  it("reports partial when some batches fail", async () => {
    let call = 0;
    const fetchImpl = (async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify({ ok: true, data: { generated: 2, failed: 0 } }), {
          status: 200,
        });
      }
      return new Response("boom", { status: 500 });
    }) as typeof fetch;
    // 26 tenants → two batches (25 + 1); second batch 500s.
    const tenants = Array.from({ length: 26 }, (_, i) => `t_${i}`);
    const outcome = await runCreatorWeeklyOnce(fakeDb(tenants), {
      fetchImpl,
      webV2InternalUrl: "http://web:5000",
      internalServiceToken: "tok",
    });
    assert.equal(outcome.status, "partial");
    assert.equal(outcome.sent, 2);
    assert.equal(outcome.failed, 1);
  });
});
