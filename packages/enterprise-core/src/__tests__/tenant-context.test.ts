import { describe, expect, it } from "vitest";
import {
  MissingTenantContextError,
  isFamilyOnlyTenant,
  requireTenantContext,
} from "../tenant-context.js";
import { createRequestContext } from "../request-context.js";
import { buildAuditContext } from "../audit-context.js";

describe("requireTenantContext", () => {
  it("returns the context when valid", () => {
    const ctx = requireTenantContext({ tenantId: "t1", role: "parent" });
    expect(ctx.tenantId).toBe("t1");
    expect(ctx.role).toBe("parent");
  });

  it("throws when context is undefined", () => {
    expect(() => requireTenantContext(undefined)).toThrow(MissingTenantContextError);
  });

  it("throws when tenantId is missing", () => {
    expect(() => requireTenantContext({ tenantId: "", role: "parent" })).toThrow(
      MissingTenantContextError,
    );
  });
});

describe("isFamilyOnlyTenant", () => {
  it("returns true when no district or school is set", () => {
    expect(isFamilyOnlyTenant({ tenantId: "t1", role: "parent" })).toBe(true);
  });

  it("returns false when district is present", () => {
    expect(isFamilyOnlyTenant({ tenantId: "t1", role: "parent", districtId: "d1" })).toBe(false);
  });
});

describe("createRequestContext", () => {
  it("assigns a request id when none is supplied", () => {
    const ctx = createRequestContext();
    expect(typeof ctx.requestId).toBe("string");
    expect(ctx.requestId.length).toBeGreaterThan(0);
    expect(ctx.correlationId).toBe(ctx.requestId);
  });

  it("preserves correlation ids passed in", () => {
    const ctx = createRequestContext({
      requestId: "req-1",
      correlationId: "corr-9",
      actorId: "u1",
      actorRole: "parent",
    });
    expect(ctx.requestId).toBe("req-1");
    expect(ctx.correlationId).toBe("corr-9");
    expect(ctx.actorRole).toBe("parent");
  });

  it("derives actor role from tenant context when not given", () => {
    const ctx = createRequestContext({
      tenant: { tenantId: "t1", role: "teacher" },
    });
    expect(ctx.actorRole).toBe("teacher");
  });
});

describe("buildAuditContext", () => {
  it("inherits actor and tenant from request context", () => {
    const request = createRequestContext({
      actorId: "u1",
      actorRole: "parent",
      tenant: { tenantId: "t1", role: "parent", learnerId: "l1" },
      correlationId: "corr-1",
    });
    const audit = buildAuditContext({
      request,
      action: "profile_recommendation_approved",
      resourceType: "profile_recommendation",
      resourceId: "rec-1",
    });
    expect(audit.actorId).toBe("u1");
    expect(audit.actorRole).toBe("parent");
    expect(audit.tenantId).toBe("t1");
    expect(audit.learnerId).toBe("l1");
    expect(audit.correlationId).toBe("corr-1");
  });
});
