import { describe, expect, it } from "vitest";
import { describeSystemHealthFailure } from "./health-state";

// Mirrors @aivo/admin-api's AdminApiError without importing it (the package
// pulls in "server-only", which throws outside a React Server environment).
function adminApiError(message: string, status: number): Error {
  const error = new Error(message) as Error & { status: number };
  error.name = "AdminApiError";
  error.status = status;
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

  it("reports network-level failures as admin-svc being unreachable", () => {
    expect(describeSystemHealthFailure(new TypeError("fetch failed"))).toContain(
      "could not be reached",
    );
    expect(describeSystemHealthFailure(undefined)).toContain("could not be reached");
  });
});
