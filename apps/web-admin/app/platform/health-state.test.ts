import { describe, expect, it } from "vitest";
import { describeSystemHealthFailure } from "./health-state";

// Mirrors @aivo/admin-api's AdminApiError without importing it (the package
// pulls in "server-only", which throws outside a React Server environment).
function adminApiError(message: string, status: number, payload?: unknown): Error {
  const error = new Error(message) as Error & { status: number; payload?: unknown };
  error.name = "AdminApiError";
  error.status = status;
  error.payload = payload;
  return error;
}

describe("describeSystemHealthFailure", () => {
  it("flags 401/403 as a credential problem between admin-svc and identity-svc", () => {
    for (const status of [401, 403]) {
      const detail = describeSystemHealthFailure(adminApiError("invalid_token", status));
      expect(detail).toContain(`${status}: invalid_token`);
      expect(detail).toContain("JWT public key");
    }
  });

  it("reports other admin-svc error statuses with their message", () => {
    const detail = describeSystemHealthFailure(adminApiError("relation does not exist", 500));
    expect(detail).toContain("500: relation does not exist");
  });

  it("surfaces the Fastify 500 body's message field (the actual DB error)", () => {
    // Fastify's default 500 body: `error` is generic, `message` is the cause.
    const detail = describeSystemHealthFailure(
      adminApiError("Internal Server Error", 500, {
        statusCode: 500,
        error: "Internal Server Error",
        message: 'Failed query: select count(*)\nfrom "ai_usage_log"',
      }),
    );
    expect(detail).toContain("500: Internal Server Error");
    expect(detail).toContain('Failed query: select count(*) from "ai_usage_log"');
  });

  it("surfaces the detail field of admin-svc's system_health_unavailable 503", () => {
    const detail = describeSystemHealthFailure(
      adminApiError("system_health_unavailable", 503, {
        error: "system_health_unavailable",
        detail: "connect ECONNREFUSED 10.0.0.1:6432",
        issues: [],
      }),
    );
    expect(detail).toContain("503: system_health_unavailable");
    expect(detail).toContain("connect ECONNREFUSED 10.0.0.1:6432");
  });

  it("does not repeat the detail when it matches the error message", () => {
    const detail = describeSystemHealthFailure(
      adminApiError("invalid_request", 400, { error: "invalid_request", message: "invalid_request" }),
    );
    expect(detail).toBe("admin-svc responded with an error (400: invalid_request).");
  });

  it("reports network-level failures as admin-svc being unreachable", () => {
    expect(describeSystemHealthFailure(new TypeError("fetch failed"))).toContain(
      "could not be reached",
    );
    expect(describeSystemHealthFailure(undefined)).toContain("could not be reached");
  });
});
