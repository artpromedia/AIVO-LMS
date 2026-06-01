import { test } from "node:test";
import assert from "node:assert";
import { mergeAvailableRoles } from "../src/lib/available-roles.js";

test("mergeAvailableRoles keeps the base role first and de-dups", () => {
  assert.deepEqual(mergeAvailableRoles("PARENT", []), ["PARENT"]);
  assert.deepEqual(mergeAvailableRoles("PARENT", ["TEACHER", "PARENT"]), ["PARENT", "TEACHER"]);
  assert.deepEqual(mergeAvailableRoles("PARENT", ["TEACHER", "CAREGIVER"]), [
    "PARENT",
    "TEACHER",
    "CAREGIVER",
  ]);
});

test("mergeAvailableRoles drops empty/falsy roles", () => {
  assert.deepEqual(mergeAvailableRoles("PARENT", ["", "TEACHER"]), ["PARENT", "TEACHER"]);
  assert.deepEqual(mergeAvailableRoles("", ["TEACHER"]), ["TEACHER"]);
});
