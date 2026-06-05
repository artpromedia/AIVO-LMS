import { test } from "node:test";
import assert from "node:assert/strict";
import { Permission } from "@aivo/security";
import {
  delegatedAdminRbacV2Enabled,
  permissionsForCurrentRole,
  requestHasPermission,
} from "../src/lib/permissions.js";

test("permissionsForCurrentRole derives only the active role permission set", () => {
  const permissions = permissionsForCurrentRole("DISTRICT_ADMIN");
  assert.ok(permissions.includes(Permission.SchoolCreate));
  assert.ok(!permissions.includes(Permission.StaffProvision));
});

test("requestHasPermission falls back to the role matrix when token claims are absent", () => {
  assert.equal(
    requestHasPermission({ role: "SCHOOL_ADMIN" }, Permission.LearnerCreate),
    true,
  );
  assert.equal(
    requestHasPermission({ role: "SCHOOL_ADMIN" }, Permission.SchoolCreate),
    false,
  );
});

test("requestHasPermission uses the current token permission bag, not available roles", () => {
  const payload = {
    role: "TEACHER",
    permissions: [Permission.ClassRead, Permission.ClassWrite],
    availableRoles: ["TEACHER", "DISTRICT_ADMIN"],
  };
  assert.equal(requestHasPermission(payload, Permission.ClassWrite), true);
  assert.equal(requestHasPermission(payload, Permission.SchoolCreate), false);
});

test("delegatedAdminRbacV2Enabled defaults off", () => {
  assert.equal(delegatedAdminRbacV2Enabled(), false);
});
