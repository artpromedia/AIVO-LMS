/**
 * Pure-logic tests for the teacher/caregiver suggestion route (Sprint 5).
 * The DB-backed route is verified by `tsc`; these cover the deterministic
 * classification the route relies on. No DB / no Fastify.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contributorRoleFromClaims,
  mapSuggestionType,
} from "../src/routes/suggestions.js";

test("contributorRoleFromClaims maps platform roles to contributor roles", () => {
  assert.equal(contributorRoleFromClaims("TEACHER"), "teacher");
  assert.equal(contributorRoleFromClaims("THERAPIST"), "therapist");
  assert.equal(contributorRoleFromClaims("PARENT"), "parent");
  assert.equal(contributorRoleFromClaims("GUARDIAN"), "parent");
  // Unknown / caregiver-by-default.
  assert.equal(contributorRoleFromClaims("CAREGIVER"), "caregiver");
  assert.equal(contributorRoleFromClaims(undefined), "caregiver");
});

test("mapSuggestionType maps to valid brain_recommendations enum values", () => {
  assert.equal(mapSuggestionType("tutor_strategy"), "tutor_suggestion");
  assert.equal(mapSuggestionType("accommodation"), "accommodation_add");
  assert.equal(mapSuggestionType("goal"), "goal_suggestion");
  assert.equal(mapSuggestionType("pacing"), "path_adjustment");
  assert.equal(mapSuggestionType("sensory"), "accommodation_add");
  // Defaults safely for unknown input.
  assert.equal(mapSuggestionType("nonsense"), "tutor_suggestion");
  assert.equal(mapSuggestionType(undefined), "tutor_suggestion");
});
