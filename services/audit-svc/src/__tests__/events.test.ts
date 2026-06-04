import { describe, it, expect } from "vitest";
import type { AuditEventInput } from "@aivo/audit-client";
import { InMemoryEventStore } from "../services/event-store.js";
import { verifyChain, hashEvent, GENESIS_HASH } from "../lib/hashChain.js";

function input(over: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    occurred_at: over.occurred_at ?? new Date().toISOString(),
    tenant_id: over.tenant_id ?? "t1",
    actor: over.actor ?? { id: "u1", role: "platform_admin", ip: "1.2.3.4", ua: "test" },
    action: over.action ?? "identity.idp.created",
    entity: over.entity ?? { type: "idp", id: "idp1" },
    outcome: over.outcome ?? "success",
    details: over.details ?? { protocol: "saml" },
    request_id: over.request_id ?? "req-1",
    id: over.id,
  };
}

describe("hash chain continuity", () => {
  it("links each event to the previous and verifies intact", async () => {
    const store = new InMemoryEventStore();
    const a = await store.append(input({ action: "a.1" }));
    const b = await store.append(input({ action: "a.2" }));
    const c = await store.append(input({ action: "a.3" }));
    expect(a.prev_hash).toBe(GENESIS_HASH);
    expect(b.prev_hash).toBe(a.hash);
    expect(c.prev_hash).toBe(b.hash);
    expect(await store.verify()).toBeNull();
    // Recomputing externally matches.
    expect(hashEvent(a.hash, b)).toBe(b.hash);
  });

  it("detects a tampered payload (hash-mismatch)", async () => {
    const store = new InMemoryEventStore();
    await store.append(input({ action: "a.1" }));
    const target = await store.append(input({ action: "a.2", id: "tamper-me" }));
    await store.append(input({ action: "a.3" }));
    store._tamper(target.id, (e) => {
      e.details = { protocol: "oidc", injected: true };
    });
    const brk = await store.verify();
    expect(brk).not.toBeNull();
    expect(brk!.id).toBe("tamper-me");
    expect(brk!.reason).toBe("hash-mismatch");
  });

  it("detects a deleted/reordered event (prev-hash-mismatch)", () => {
    // Build three valid events then drop the middle one.
    const e1 = { ...input({ id: "1" }), prev_hash: GENESIS_HASH } as any;
    e1.hash = hashEvent(GENESIS_HASH, e1);
    const e2 = { ...input({ id: "2" }), prev_hash: e1.hash } as any;
    e2.hash = hashEvent(e1.hash, e2);
    const e3 = { ...input({ id: "3" }), prev_hash: e2.hash } as any;
    e3.hash = hashEvent(e2.hash, e3);
    const brk = verifyChain([e1, e3]); // e2 removed
    expect(brk?.reason).toBe("prev-hash-mismatch");
    expect(brk?.id).toBe("3");
  });
});

describe("query filters + paging", () => {
  it("filters by tenant, actor, action, entity, time, and free-text", async () => {
    const store = new InMemoryEventStore();
    await store.append(
      input({
        tenant_id: "t1",
        action: "identity.login",
        actor: { id: "u1", role: "teacher", ip: "", ua: "" },
        details: { method: "password" },
      }),
    );
    await store.append(
      input({
        tenant_id: "t2",
        action: "billing.seat.assigned",
        entity: { type: "seat", id: "s1" },
        details: { plan: "pro" },
      }),
    );
    await store.append(
      input({ tenant_id: "t1", action: "sis.sync.trigger", details: { provider: "clever" } }),
    );

    expect((await store.query({ tenantId: "t1" })).events).toHaveLength(2);
    expect((await store.query({ action: "billing.seat.assigned" })).events).toHaveLength(1);
    expect((await store.query({ entityType: "seat" })).events).toHaveLength(1);
    expect((await store.query({ q: "clever" })).events).toHaveLength(1);
    expect((await store.query({ actorRole: "teacher" })).events).toHaveLength(1);
  });

  it("pages with a cursor, newest first", async () => {
    const store = new InMemoryEventStore();
    for (let i = 0; i < 5; i++) await store.append(input({ action: `a.${i}`, id: `e${i}` }));
    const p1 = await store.query({ limit: 2 });
    expect(p1.events.map((e) => e.id)).toEqual(["e4", "e3"]);
    expect(p1.nextCursor).toBe("e3");
    const p2 = await store.query({ limit: 2, cursor: p1.nextCursor! });
    expect(p2.events.map((e) => e.id)).toEqual(["e2", "e1"]);
  });
});

describe("single-event proof + streaming export", () => {
  it("returns prev/hash/next for a proof view", async () => {
    const store = new InMemoryEventStore();
    const a = await store.append(input({ id: "p1" }));
    const b = await store.append(input({ id: "p2" }));
    const proof = await store.proof("p1");
    expect(proof).toEqual({ prev_hash: a.prev_hash, hash: a.hash, next_hash: b.hash });
    expect((await store.proof("p2"))!.next_hash).toBeNull();
  });

  it("streams all matching events for export", async () => {
    const store = new InMemoryEventStore();
    for (let i = 0; i < 100; i++) await store.append(input({ tenant_id: i % 2 ? "t1" : "t2" }));
    const collected = [];
    for await (const e of store.stream({ tenantId: "t1" })) collected.push(e);
    expect(collected).toHaveLength(50);
  });
});
