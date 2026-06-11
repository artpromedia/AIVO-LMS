import { describe, expect, it } from "vitest";
import { buildCsp, makeNonce, sentryOriginFromDsn } from "./csp";

describe("buildCsp", () => {
  it("is nonce + strict-dynamic with no unsafe script sources in production", () => {
    const csp = buildCsp({ nonce: "abc", isProd: true, reportPath: "/api/bff/csp-report" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("report-uri /api/bff/csp-report");
  });

  it("relaxes script-src for dev tooling outside production only", () => {
    const csp = buildCsp({ nonce: "abc", isProd: false, reportPath: "/r" });
    expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(csp).toMatch(/connect-src[^;]*ws:/);
  });

  it("allowlists exactly the Sentry ingest origin when a DSN is set", () => {
    const csp = buildCsp({
      nonce: "n",
      isProd: true,
      sentryDsn: "https://abc@o123.ingest.sentry.io/456",
      reportPath: "/r",
    });
    expect(csp).toContain("connect-src 'self' https://o123.ingest.sentry.io");
    expect(csp).not.toContain("abc@");
  });

  it("tolerates a malformed DSN without breaking the policy", () => {
    expect(sentryOriginFromDsn("not a url")).toBeNull();
    const csp = buildCsp({ nonce: "n", isProd: true, sentryDsn: "not a url", reportPath: "/r" });
    expect(csp).toContain("connect-src 'self';");
  });

  it("produces unique base64 nonces", () => {
    const a = makeNonce();
    const b = makeNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
