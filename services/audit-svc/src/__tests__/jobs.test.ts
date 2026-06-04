import { describe, it, expect, vi } from "vitest";
import type { AuditEventInput } from "@aivo/audit-client";
import { InMemoryEventStore } from "../services/event-store.js";
import { runAnchorOnce, type WormStore, type AnchorSink } from "../jobs/anchor.js";
import { runTamperCheckOnce } from "../jobs/tamper.js";
import {
  partitionsToPrune,
  partitionSuffix,
  runRetentionOnce,
  FERPA_MIN_DAYS,
  type PartitionArchiver,
} from "../jobs/retention.js";

function input(over: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    occurred_at: over.occurred_at ?? new Date().toISOString(),
    tenant_id: over.tenant_id ?? "t1",
    actor: { id: "u1", role: "platform_admin", ip: "", ua: "" },
    action: over.action ?? "a.b",
    entity: { type: "x", id: "1" },
    outcome: "success",
    details: {},
    request_id: "r",
    id: over.id,
  };
}

describe("anchor job", () => {
  it("computes head hash + count for a window and mirrors to WORM", async () => {
    const store = new InMemoryEventStore();
    await store.append(input({ occurred_at: "2026-01-01T00:00:00.000Z", id: "e1" }));
    await store.append(input({ occurred_at: "2026-01-02T00:00:00.000Z", id: "e2" }));
    const head = await store.append(input({ occurred_at: "2026-01-03T00:00:00.000Z", id: "e3" }));

    const worm: WormStore = { put: vi.fn(async () => ({ ref: "s3://bucket/key#v1" })) };
    const saved: unknown[] = [];
    const sink: AnchorSink = {
      save: async (r) => {
        saved.push(r);
      },
    };

    const rec = await runAnchorOnce(store, worm, sink, {
      windowStart: "2026-01-01T00:00:00.000Z",
      windowEnd: "2026-01-31T00:00:00.000Z",
    });
    expect(rec.eventCount).toBe(3);
    expect(rec.headHash).toBe(head.hash); // latest event in window
    expect(rec.wormRef).toBe("s3://bucket/key#v1");
    expect(worm.put).toHaveBeenCalledOnce();
    expect(saved).toHaveLength(1);
  });
});

describe("tamper job", () => {
  it("alerts on a chain break and stays silent when intact", async () => {
    const store = new InMemoryEventStore();
    await store.append(input({ id: "ok1" }));
    const t = await store.append(input({ id: "victim" }));
    await store.append(input({ id: "ok2" }));

    const alert = vi.fn(async () => {});
    expect(await runTamperCheckOnce(store, { alert })).toBeNull();
    expect(alert).not.toHaveBeenCalled();

    store._tamper(t.id, (e) => {
      e.details = { tampered: true };
    });
    const brk = await runTamperCheckOnce(store, { alert });
    expect(brk?.id).toBe("victim");
    expect(alert).toHaveBeenCalledOnce();
  });
});

describe("retention job", () => {
  it("prunes partitions whose month ended before the retention cutoff", () => {
    const now = new Date("2033-06-15T00:00:00Z"); // ~7y after 2026
    const existing = ["202601", "202602", "202605", "203305", "203306"];
    const prune = partitionsToPrune(existing, FERPA_MIN_DAYS, now);
    // 2026 partitions are >7y old; 2033 ones are recent and retained.
    expect(prune).toContain("202601");
    expect(prune).not.toContain("203306");
  });

  it("partitionSuffix formats YYYYMM in UTC", () => {
    expect(partitionSuffix(new Date("2026-03-09T00:00:00Z"))).toBe("202603");
  });

  it("archives before dropping each pruned partition", async () => {
    const order: string[] = [];
    const archiver: PartitionArchiver = {
      listPartitions: async () => ["201801", "201802"],
      archive: async (s) => {
        order.push(`archive:${s}`);
      },
      drop: async (s) => {
        order.push(`drop:${s}`);
      },
    };
    const res = await runRetentionOnce(archiver, { now: new Date("2030-01-01T00:00:00Z") });
    expect(res.pruned).toEqual(["201801", "201802"]);
    // archive must precede drop for each partition.
    expect(order).toEqual(["archive:201801", "drop:201801", "archive:201802", "drop:201802"]);
  });
});
