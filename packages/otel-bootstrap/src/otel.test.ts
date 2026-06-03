import { describe, expect, it } from "vitest";
import {
  bootstrapOtel,
  assertTenantSpanAttribute,
  parseTraceparent,
  formatTraceparent,
  parseBaggage,
  formatBaggage,
  TENANT_BAGGAGE_KEY,
} from "./index.js";

describe("W3C trace context", () => {
  it("round-trips a traceparent", () => {
    const ctx = { traceId: "a".repeat(32), spanId: "b".repeat(16), sampled: true };
    const header = formatTraceparent(ctx);
    expect(header).toBe(`00-${"a".repeat(32)}-${"b".repeat(16)}-01`);
    const parsed = parseTraceparent(header);
    expect(parsed?.traceId).toBe("a".repeat(32));
    expect(parsed?.parentSpanId).toBe("b".repeat(16));
  });

  it("rejects malformed traceparent", () => {
    expect(parseTraceparent("garbage")).toBeNull();
    expect(parseTraceparent(`00-${"0".repeat(32)}-${"b".repeat(16)}-01`)).toBeNull();
  });

  it("continues an incoming trace id across services", () => {
    const otel = bootstrapOtel("svc-a");
    const span = otel.startSpan("op", { traceparent: `00-${"c".repeat(32)}-${"d".repeat(16)}-01` });
    expect(span.context.traceId).toBe("c".repeat(32));
  });
});

describe("baggage tenant propagation", () => {
  it("round-trips baggage", () => {
    const header = formatBaggage({ [TENANT_BAGGAGE_KEY]: "tenant-1" });
    expect(parseBaggage(header)[TENANT_BAGGAGE_KEY]).toBe("tenant-1");
  });

  it("binds tenant_id from baggage onto the span", () => {
    const otel = bootstrapOtel("svc-a");
    const span = otel.startSpan("op", { baggage: `${TENANT_BAGGAGE_KEY}=tenant-42` });
    expect(span.tenantId).toBe("tenant-42");
    expect(span.attributes.tenant_id).toBe("tenant-42");
  });

  it("propagates traceparent + baggage to downstream headers", () => {
    const otel = bootstrapOtel("svc-a");
    const span = otel.startSpan("op", { baggage: `${TENANT_BAGGAGE_KEY}=tenant-42` });
    const out = otel.outboundHeaders(span);
    expect(out.traceparent).toContain("00-");
    expect(out.baggage).toContain("tenant-42");
  });
});

describe("assertTenantSpanAttribute", () => {
  it("throws when tenant_id missing", () => {
    const otel = bootstrapOtel("svc-a");
    const span = otel.startSpan("op", {});
    expect(() => assertTenantSpanAttribute(span)).toThrow(/tenant_id/);
  });

  it("passes when tenant_id present", () => {
    const otel = bootstrapOtel("svc-a");
    const span = otel.startSpan("op", { baggage: `${TENANT_BAGGAGE_KEY}=t1` });
    expect(() => assertTenantSpanAttribute(span)).not.toThrow();
  });

  it("allows anonymous spans to skip the assertion", () => {
    const otel = bootstrapOtel("svc-a");
    const span = otel.startSpan("healthz", {});
    expect(() => assertTenantSpanAttribute(span, { allowAnonymous: true })).not.toThrow();
  });
});
