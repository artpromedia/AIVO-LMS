import { describe, expect, it } from "vitest";
import { checkSameOrigin } from "./csrf";

function req(method: string, headers: Record<string, string> = {}, url = "https://app.aivolearning.com/api/bff/x") {
  return new Request(url, { method, headers });
}

describe("checkSameOrigin — CSRF guard", () => {
  it("always passes safe methods", () => {
    expect(checkSameOrigin(req("GET", { "sec-fetch-site": "cross-site" })).ok).toBe(true);
    expect(checkSameOrigin(req("HEAD")).ok).toBe(true);
  });

  it("passes same-origin browser mutations via fetch metadata", () => {
    expect(checkSameOrigin(req("POST", { "sec-fetch-site": "same-origin" })).ok).toBe(true);
    expect(checkSameOrigin(req("POST", { "sec-fetch-site": "none" })).ok).toBe(true);
  });

  it("rejects cross-site browser mutations via fetch metadata", () => {
    const verdict = checkSameOrigin(req("POST", { "sec-fetch-site": "cross-site" }));
    expect(verdict).toEqual({ ok: false, reason: "sec-fetch-cross-site" });
    expect(checkSameOrigin(req("DELETE", { "sec-fetch-site": "same-site" })).ok).toBe(false);
  });

  it("falls back to Origin matching for browsers without fetch metadata", () => {
    expect(
      checkSameOrigin(req("POST", { origin: "https://app.aivolearning.com" })).ok,
    ).toBe(true);
    expect(
      checkSameOrigin(req("POST", { origin: "https://evil.example.com" })),
    ).toEqual({ ok: false, reason: "origin-mismatch" });
  });

  it("honors x-forwarded-host behind the proxy", () => {
    const verdict = checkSameOrigin(
      req("POST", {
        origin: "https://app.aivolearning.com",
        "x-forwarded-host": "app.aivolearning.com",
      }, "http://127.0.0.1:5000/api/bff/x"),
    );
    expect(verdict.ok).toBe(true);
  });

  it("rejects a malformed Origin", () => {
    expect(checkSameOrigin(req("POST", { origin: "not a url" })).ok).toBe(false);
  });

  it("passes non-browser clients (no Origin, no fetch metadata) — webhooks/curl", () => {
    expect(checkSameOrigin(req("POST")).ok).toBe(true);
  });
});
