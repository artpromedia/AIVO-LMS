import { describe, expect, it } from "vitest";
import {
  createImpWriteAllowlist,
  decideImpersonatedRequest,
  isImpersonation,
  isImpersonationExpired,
  isRouteWriteAllowlisted,
  isWriteMethod,
  type ImpersonationClaimView,
} from "../impersonation-guard.js";

const future = Math.floor(Date.now() / 1000) + 600;
const past = Math.floor(Date.now() / 1000) - 1;

function impClaims(overrides: Partial<ImpersonationClaimView> = {}): ImpersonationClaimView {
  return {
    imp: true,
    act: "admin-1",
    sub: "user-2",
    imp_exp: future,
    imp_writes_ok: false,
    imp_reason: "support",
    imp_sid: "imp_sess_1",
    ...overrides,
  };
}

describe("isImpersonation / isWriteMethod", () => {
  it("detects impersonation tokens", () => {
    expect(isImpersonation(impClaims())).toBe(true);
    expect(isImpersonation({ imp: false, act: "x" })).toBe(false);
    expect(isImpersonation({ imp: true })).toBe(false); // no act
    expect(isImpersonation(null)).toBe(false);
  });
  it("classifies write methods", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(isWriteMethod(m)).toBe(true);
    for (const m of ["GET", "HEAD", "OPTIONS"]) expect(isWriteMethod(m)).toBe(false);
  });
});

describe("write allowlist", () => {
  const allow = createImpWriteAllowlist([
    { method: "POST", pathPrefix: "/api/responsible-ai/incidents" },
  ]);
  it("matches method + path prefix", () => {
    expect(isRouteWriteAllowlisted(allow, "POST", "/api/responsible-ai/incidents")).toBe(true);
    expect(isRouteWriteAllowlisted(allow, "POST", "/api/responsible-ai/incidents/123")).toBe(true);
    expect(isRouteWriteAllowlisted(allow, "post", "/api/responsible-ai/incidents")).toBe(true);
  });
  it("rejects non-matching method or path", () => {
    expect(isRouteWriteAllowlisted(allow, "DELETE", "/api/responsible-ai/incidents")).toBe(false);
    expect(isRouteWriteAllowlisted(allow, "POST", "/api/responsible-ai/models")).toBe(false);
    expect(isRouteWriteAllowlisted([], "POST", "/x")).toBe(false);
    expect(isRouteWriteAllowlisted(undefined, "POST", "/x")).toBe(false);
  });
});

describe("isImpersonationExpired", () => {
  it("is false before imp_exp, true after", () => {
    expect(isImpersonationExpired(impClaims({ imp_exp: future }))).toBe(false);
    expect(isImpersonationExpired(impClaims({ imp_exp: past }))).toBe(true);
    expect(isImpersonationExpired(impClaims({ imp_exp: undefined }))).toBe(true);
  });
});

describe("decideImpersonatedRequest — the full policy", () => {
  const allow = createImpWriteAllowlist([{ method: "POST", pathPrefix: "/api/safe" }]);

  it("passes through non-impersonation requests", () => {
    expect(decideImpersonatedRequest({ imp: false }, "POST", "/x", allow).kind).toBe(
      "not_impersonation",
    );
  });

  it("allows reads under impersonation", () => {
    expect(decideImpersonatedRequest(impClaims(), "GET", "/api/anything", allow).kind).toBe(
      "read_allowed",
    );
  });

  it("blocks writes when imp_writes_ok is false (even on an allowlisted route)", () => {
    const d = decideImpersonatedRequest(
      impClaims({ imp_writes_ok: false }),
      "POST",
      "/api/safe",
      allow,
    );
    expect(d.kind).toBe("write_blocked");
    expect(d).toMatchObject({ reason: "writes_disabled" });
  });

  it("blocks writes when route is not allowlisted (even with imp_writes_ok)", () => {
    const d = decideImpersonatedRequest(
      impClaims({ imp_writes_ok: true }),
      "POST",
      "/api/unlisted",
      allow,
    );
    expect(d.kind).toBe("write_blocked");
    expect(d).toMatchObject({ reason: "route_not_allowlisted" });
  });

  it("allows a write only when imp_writes_ok AND allowlisted", () => {
    expect(
      decideImpersonatedRequest(impClaims({ imp_writes_ok: true }), "POST", "/api/safe", allow)
        .kind,
    ).toBe("write_allowed");
  });

  it("rejects expired sessions before any write decision", () => {
    expect(
      decideImpersonatedRequest(
        impClaims({ imp_exp: past, imp_writes_ok: true }),
        "POST",
        "/api/safe",
        allow,
      ).kind,
    ).toBe("expired");
  });

  it("deny-by-default: no allowlist means no writes", () => {
    expect(
      decideImpersonatedRequest(impClaims({ imp_writes_ok: true }), "POST", "/api/safe", undefined)
        .kind,
    ).toBe("write_blocked");
  });
});
