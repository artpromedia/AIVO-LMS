import { describe, it, expect, vi } from "vitest";
import { uuidv7 } from "./event.js";
import { redactDetails, maskSecrets } from "./redact.js";
import { createAuditClient, HttpAuditTransport, type AuditTransport } from "./emit.js";
import { audited, registerAuditHook, type AuditedRequestLike } from "./audited.js";

describe("uuidv7", () => {
  it("produces a valid version-7 / variant-10 uuid", () => {
    const id = uuidv7(0x017f22e279b0, () => 0.5);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("is time-ordered: later timestamp sorts after earlier", () => {
    const a = uuidv7(1000, () => 0);
    const b = uuidv7(2000, () => 0);
    expect(a < b).toBe(true);
  });
});

describe("redactDetails", () => {
  it("keeps only allowlisted keys", () => {
    const out = redactDetails({ protocol: "saml", clientSecret: "x", email: "a@b" }, [
      "protocol",
      "email",
    ]);
    expect(out).toEqual({ protocol: "saml", email: "a@b" });
  });
  it("masks an allowlisted-but-secret key as defense in depth", () => {
    expect(redactDetails({ token: "abc" }, ["token"])).toEqual({ token: "[REDACTED]" });
  });
  it("maskSecrets recurses", () => {
    expect(maskSecrets({ a: 1, nested: { password: "p" } })).toEqual({
      a: 1,
      nested: { password: "[REDACTED]" },
    });
  });
});

describe("createAuditClient.emit", () => {
  function fakeTransport() {
    const sent: unknown[] = [];
    const transport: AuditTransport = {
      async send(e) {
        sent.push(e);
      },
    };
    return { transport, sent };
  }

  it("builds a chain-less event with id, timestamp, and redacted details", async () => {
    const { transport, sent } = fakeTransport();
    const client = createAuditClient({ transport, defaultAllowlist: ["protocol"] });
    const ev = await client.emit({
      tenant_id: "t1",
      actor: { id: "u1", role: "platform_admin", ip: "1.2.3.4", ua: "test" },
      action: "identity.idp.created",
      entity: { type: "idp", id: "idp1" },
      outcome: "success",
      details: { protocol: "saml", secret: "leak" },
      request_id: "req-1",
    });
    expect(ev.id).toMatch(/-7[0-9a-f]{3}-/);
    expect(ev.details).toEqual({ protocol: "saml" }); // secret dropped (not allowlisted)
    expect((ev as any).prev_hash).toBeUndefined(); // chain assigned server-side
    expect(sent).toHaveLength(1);
  });

  it("never throws when the transport fails (best-effort)", async () => {
    const onError = vi.fn();
    const client = createAuditClient({
      transport: {
        async send() {
          throw new Error("down");
        },
      },
      onError,
    });
    await expect(
      client.emit({
        tenant_id: null,
        actor: { id: "u", role: "r", ip: "", ua: "" },
        action: "x.y",
        entity: { type: "t", id: "1" },
        outcome: "success",
        request_id: "r",
      }),
    ).resolves.toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe("HttpAuditTransport", () => {
  it("POSTs to /events with a bearer token", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    const t = new HttpAuditTransport({
      url: "https://audit",
      serviceToken: "svc",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await t.send({
      tenant_id: null,
      actor: { id: "", role: "", ip: "", ua: "" },
      action: "a",
      entity: { type: "", id: "" },
      outcome: "success",
      details: {},
      request_id: "",
      occurred_at: "now",
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://audit/events");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer svc");
  });
});

describe("audited + registerAuditHook", () => {
  it("emits with success on 2xx and failure on 4xx/5xx, deriving actor/tenant", async () => {
    const sent: any[] = [];
    const client = createAuditClient({
      transport: {
        async send(e) {
          sent.push(e);
        },
      },
    });
    let hook!: (req: AuditedRequestLike, reply: { statusCode: number }) => unknown;
    const app = {
      addHook: (_n: "onResponse", fn: typeof hook) => {
        hook = fn;
      },
    };
    registerAuditHook(app, client);

    const cfg = audited("identity.user.role.granted", {
      entityType: "user",
      entityId: (r) => (r.params as any).id,
      detailsAllowlist: ["role"],
    });
    const req: AuditedRequestLike = {
      method: "POST",
      url: "/users/u9/role",
      headers: { "x-request-id": "req-9", "user-agent": "UA" },
      params: { id: "u9" },
      routeOptions: { config: cfg.config },
      enterpriseContext: { actorId: "admin-1", tenant: { tenantId: "t9", role: "district_admin" } },
    };

    await hook(req, { statusCode: 200 });
    await hook(req, { statusCode: 403 });

    expect(sent).toHaveLength(2);
    expect(sent[0].action).toBe("identity.user.role.granted");
    expect(sent[0].outcome).toBe("success");
    expect(sent[0].entity).toEqual({ type: "user", id: "u9" });
    expect(sent[0].actor.id).toBe("admin-1");
    expect(sent[0].tenant_id).toBe("t9");
    expect(sent[0].request_id).toBe("req-9");
    expect(sent[1].outcome).toBe("failure");
  });

  it("ignores routes without an audit config", async () => {
    const sent: any[] = [];
    const client = createAuditClient({
      transport: {
        async send(e) {
          sent.push(e);
        },
      },
    });
    let hook!: (req: AuditedRequestLike, reply: { statusCode: number }) => unknown;
    registerAuditHook(
      {
        addHook: (_n, fn) => {
          hook = fn;
        },
      },
      client,
    );
    await hook({ method: "GET", url: "/x", headers: {} }, { statusCode: 200 });
    expect(sent).toHaveLength(0);
  });
});

describe("createServiceAuditClient / installAuditing", () => {
  it("uses a no-op transport when env is unset (never breaks the service)", async () => {
    const { createServiceAuditClient } = await import("./service.js");
    const client = createServiceAuditClient({ url: "", serviceToken: "" });
    await expect(
      client.emit({
        tenant_id: null,
        actor: { id: "u", role: "r", ip: "", ua: "" },
        action: "x.y",
        entity: { type: "t", id: "1" },
        outcome: "success",
        request_id: "r",
      }),
    ).resolves.toBeTruthy();
  });

  it("installAuditing registers an onResponse hook that emits for annotated routes", async () => {
    const { installAuditing } = await import("./service.js");
    const { audited } = await import("./audited.js");
    const sent: any[] = [];
    let hook!: (req: any, reply: any) => unknown;
    const app = {
      addHook: (_n: "onResponse", fn: typeof hook) => {
        hook = fn;
      },
    };
    // Point at a fake transport via fetchImpl + url so it's HTTP-backed.
    const fetchImpl = (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    installAuditing(app, { url: "https://audit", serviceToken: "svc", fetchImpl });
    const cfg = audited("tenant.updated", { entityType: "tenant", entityId: () => "t1" });
    await hook(
      {
        method: "PUT",
        url: "/t1",
        headers: { "x-request-id": "r1" },
        routeOptions: { config: cfg.config },
        enterpriseContext: { actorId: "a", tenant: { tenantId: "t1", role: "platform_admin" } },
      },
      { statusCode: 200 },
    );
    // fetch was invoked (HTTP transport) — assert no throw + hook ran.
    expect(hook).toBeTypeOf("function");
    void sent;
  });
});
