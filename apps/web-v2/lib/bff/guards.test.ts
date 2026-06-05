import { describe, expect, it } from "vitest";
import { Permission } from "@aivo/security";
import { requirePermission, requireRole } from "./guards";
import type { SessionProfile } from "@/lib/auth/types";

const baseSession: SessionProfile = {
  userId: "u_platform",
  tenantId: "t_platform",
  role: "platform_admin",
  email: "platform@example.com",
  displayName: "Platform Admin",
  permissions: ["*"],
  capabilities: ["*"],
};

describe("requirePermission", () => {
  it("allows a session whose active role grants the permission", () => {
    expect(requirePermission(baseSession, Permission.UserRead, "req_1")).toBeNull();
  });

  it("rejects when the active role does not grant the permission", () => {
    const res = requirePermission(
      { ...baseSession, role: "marketing", permissions: [], capabilities: [] },
      Permission.UserRead,
      "req_2",
    );
    expect(res?.status).toBe(403);
  });
});

describe("requireRole", () => {
  it("continues to enforce explicit role guards for backward compatibility", () => {
    expect(requireRole(baseSession, ["platform_admin"], "req_3")).toBeNull();
    expect(requireRole({ ...baseSession, role: "support" }, ["platform_admin"], "req_4")?.status).toBe(
      403,
    );
  });
});
