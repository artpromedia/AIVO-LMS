import { describe, it, expect, vi, afterEach } from "vitest";
import { validateAuditEventInput, AuditSchemaError, AUDIT_ACTION_PATTERN } from "./schema.js";
import { createAuditClient, type AuditTransport } from "./emit.js";
import type { AuditEventInput } from "./event.js";

function validEvent(overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    occurred_at: new Date().toISOString(),
    tenant_id: "t1",
    actor: { id: "u1", role: "platform_admin", ip: "1.2.3.4", ua: "vitest" },
    action: "admin.user.viewed",
    entity: { type: "user", id: "u9" },
    outcome: "success",
    details: {},
    request_id: "req-1",
    ...overrides,
  };
}

describe("validateAuditEventInput", () => {
  it("accepts the canonical producer shape", () => {
    expect(validateAuditEventInput(validEvent())).toEqual({ ok: true, issues: [] });
  });

  it("accepts a null tenant (platform-global) and empty entity id (list ops)", () => {
    const verdict = validateAuditEventInput(
      validEvent({ tenant_id: null, entity: { type: "audit_export", id: "" } }),
    );
    expect(verdict.ok).toBe(true);
  });

  it("rejects a single-segment action (must be dot.namespaced)", () => {
    const verdict = validateAuditEventInput(validEvent({ action: "viewed" }));
    expect(verdict.ok).toBe(false);
    expect(verdict.issues.join(" ")).toContain("action");
    expect(AUDIT_ACTION_PATTERN.test("admin.user.viewed")).toBe(true);
    expect(AUDIT_ACTION_PATTERN.test("UPPER.case")).toBe(false);
  });

  it("rejects a missing entity type and a bogus outcome", () => {
    const bad = validEvent({
      entity: { type: "", id: "x" },
      outcome: "partial" as unknown as AuditEventInput["outcome"],
    });
    const verdict = validateAuditEventInput(bad);
    expect(verdict.ok).toBe(false);
    expect(verdict.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects a non-ISO occurred_at", () => {
    expect(validateAuditEventInput(validEvent({ occurred_at: "yesterday" })).ok).toBe(false);
  });

  it("issue strings carry paths, never values", () => {
    const verdict = validateAuditEventInput(validEvent({ action: "secret-payload-here" }));
    expect(verdict.ok).toBe(false);
    expect(verdict.issues[0]).toMatch(/^action: /);
    expect(verdict.issues[0]).not.toContain("secret-payload-here");
  });
});

describe("createAuditClient.emit schema enforcement", () => {
  function fakeTransport() {
    const sent: AuditEventInput[] = [];
    const transport: AuditTransport = {
      async send(e) {
        sent.push(e);
      },
    };
    return { transport, sent };
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws AuditSchemaError outside production (fail loudly in dev)", async () => {
    const { transport } = fakeTransport();
    const client = createAuditClient({ transport });
    await expect(
      client.emit({
        tenant_id: null,
        actor: { id: "u", role: "r", ip: "", ua: "" },
        action: "notdotted",
        entity: { type: "t", id: "1" },
        outcome: "success",
        request_id: "r",
      }),
    ).rejects.toBeInstanceOf(AuditSchemaError);
  });

  it("in production still emits, marked schema_violation (drop-never)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { transport, sent } = fakeTransport();
    const onSchemaViolation = vi.fn();
    const client = createAuditClient({ transport, onSchemaViolation });
    const ev = await client.emit({
      tenant_id: null,
      actor: { id: "u", role: "r", ip: "", ua: "" },
      action: "notdotted",
      entity: { type: "t", id: "1" },
      outcome: "success",
      request_id: "r",
    });
    expect(sent).toHaveLength(1);
    expect(ev.details.schema_violation).toBe(true);
    expect(Array.isArray(ev.details.schema_issues)).toBe(true);
    expect(onSchemaViolation).toHaveBeenCalledOnce();
  });

  it("valid events pass through untouched", async () => {
    const { transport, sent } = fakeTransport();
    const client = createAuditClient({ transport, defaultAllowlist: ["protocol"] });
    const ev = await client.emit({
      tenant_id: "t1",
      actor: { id: "u1", role: "platform_admin", ip: "1.2.3.4", ua: "vitest" },
      action: "identity.idp.created",
      entity: { type: "idp", id: "idp1" },
      outcome: "success",
      details: { protocol: "saml" },
      request_id: "req-1",
    });
    expect(sent).toHaveLength(1);
    expect(ev.details.schema_violation).toBeUndefined();
  });
});
