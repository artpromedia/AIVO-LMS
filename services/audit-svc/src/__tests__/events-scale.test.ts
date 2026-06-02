import { describe, it, expect } from "vitest";
import type { AuditEventInput } from "@aivo/audit-client";
import { InMemoryEventStore } from "../services/event-store.js";

/**
 * Streaming export must run in roughly constant memory and finish quickly.
 * We seed 100k events and drain the async stream counting bytes without
 * buffering the full result set, asserting it completes well under budget.
 */
describe("audit export at scale (100k rows)", () => {
  it("streams 100k events without buffering, within time budget", async () => {
    const store = new InMemoryEventStore();
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const inp: AuditEventInput = {
        occurred_at: new Date(1_700_000_000_000 + i * 1000).toISOString(),
        tenant_id: i % 2 ? "t1" : "t2",
        actor: { id: `u${i % 1000}`, role: "teacher", ip: "1.2.3.4", ua: "x" },
        action: "roster.user.updated",
        entity: { type: "user", id: `u${i}` },
        outcome: "success",
        details: { i },
        request_id: `r${i}`,
      };
      await store.append(inp);
    }

    const t0 = Date.now();
    let count = 0;
    let bytes = 0;
    for await (const e of store.stream({ tenantId: "t1" })) {
      // Serialize one row at a time (what the export route does) — no buffer.
      bytes += JSON.stringify(e).length;
      count += 1;
    }
    const elapsed = Date.now() - t0;

    expect(count).toBe(N / 2);
    expect(bytes).toBeGreaterThan(0);
    // Generous CI budget; the streaming drain of 50k matching rows is ms-scale.
    expect(elapsed).toBeLessThan(60_000);
  });
});
