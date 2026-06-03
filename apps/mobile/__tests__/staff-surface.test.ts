import { describe, it, expect } from "vitest";

import {
  STAFF_LOGIN_ENDPOINTS,
  staffLoginEndpointFor,
} from "../lib/auth/staff-surface";

describe("staffLoginEndpointFor (#4 mobile staff/district login)", () => {
  it("routes an admin wrong-surface bounce to admin-login", () => {
    expect(
      staffLoginEndpointFor(403, {
        error: "Staff accounts must sign in at admin.aivolearning.com.",
        wrongSurface: "admin",
        redirectTo: "https://admin.aivolearning.com/login",
      }),
    ).toBe(STAFF_LOGIN_ENDPOINTS.admin);
  });

  it("routes a district wrong-surface bounce to district-login", () => {
    expect(
      staffLoginEndpointFor(403, {
        error: "District administrators must sign in at district.aivolearning.com.",
        wrongSurface: "district",
        redirectTo: "https://district.aivolearning.com/login",
      }),
    ).toBe(STAFF_LOGIN_ENDPOINTS.district);
  });

  it("does not retry on a plain 401 invalid-credentials response", () => {
    expect(staffLoginEndpointFor(401, { error: "Invalid credentials" })).toBeNull();
  });

  it("does not retry on a successful (200) response", () => {
    expect(staffLoginEndpointFor(200, { accessToken: "jwt" })).toBeNull();
  });

  it("does not retry on a 403 without a recognised wrongSurface hint", () => {
    expect(
      staffLoginEndpointFor(403, { error: "Account has been deactivated. Contact support." }),
    ).toBeNull();
    expect(staffLoginEndpointFor(403, { wrongSurface: "parent" })).toBeNull();
  });

  it("tolerates missing / non-object bodies", () => {
    expect(staffLoginEndpointFor(403, null)).toBeNull();
    expect(staffLoginEndpointFor(403, undefined)).toBeNull();
    expect(staffLoginEndpointFor(403, "nope")).toBeNull();
  });
});
