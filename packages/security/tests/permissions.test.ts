import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Permission,
  Role,
  allRoles,
  hasPermission,
  isRole,
  permissionsForRole,
  permissionsForRoles,
  rolePermissions,
} from "../src/index.js";

test("roles exports every server-side role including ENGINEERING", () => {
  assert.ok(allRoles.includes(Role.ENGINEERING));
  assert.equal(isRole("ENGINEERING"), true);
  assert.equal(isRole("NOT_A_ROLE"), false);
});

test("permission matrix keeps platform admin wildcard access", () => {
  assert.deepEqual(rolePermissions[Role.PLATFORM_ADMIN], [Permission.All]);
  assert.equal(hasPermission(Role.PLATFORM_ADMIN, Permission.StaffProvision), true);
});

test("district and school admins receive delegated admin permissions only", () => {
  const district = permissionsForRole(Role.DISTRICT_ADMIN);
  assert.ok(district.includes(Permission.LearnerRead));
  assert.ok(district.includes(Permission.SchoolCreate));
  assert.ok(district.includes(Permission.TeacherCreate));
  assert.ok(!district.includes(Permission.StaffProvision));

  const school = permissionsForRole(Role.SCHOOL_ADMIN);
  assert.ok(school.includes(Permission.LearnerRead));
  assert.ok(school.includes(Permission.LearnerCreate));
  assert.ok(!school.includes(Permission.SchoolCreate));
});

test("permissionsForRoles dedupes and collapses wildcard", () => {
  assert.deepEqual(permissionsForRoles([Role.SUPPORT, Role.SUPPORT]), permissionsForRole(Role.SUPPORT));
  assert.deepEqual(permissionsForRoles([Role.SUPPORT, Role.PLATFORM_ADMIN]), [Permission.All]);
});

test("internal staff are least-privilege and do not inherit staff provisioning", () => {
  const support = permissionsForRole(Role.SUPPORT);
  assert.ok(support.includes(Permission.SupportRead));
  assert.equal(hasPermission(support, Permission.StaffProvision), false);

  const engineering = permissionsForRole(Role.ENGINEERING);
  assert.ok(engineering.includes(Permission.SecurityRead));
  assert.equal(hasPermission(engineering, Permission.StaffProvision), false);
});
