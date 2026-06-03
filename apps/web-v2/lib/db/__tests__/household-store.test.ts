/**
 * Household store tests — name persistence and household-scoped co-parent
 * invite lifecycle.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetHouseholdStore,
  addCoParentInvite,
  getHousehold,
  normalizeEmail,
  setHouseholdName,
} from "@/lib/db/household-store";

describe("household-store", () => {
  beforeEach(() => _resetHouseholdStore());

  it("normalizes and validates emails", () => {
    expect(normalizeEmail("  CoParent@Example.com ")).toBe("coparent@example.com");
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(123)).toBeNull();
  });

  it("persists and clears the household name", () => {
    setHouseholdName("u1", "t1", "  The Okafor family  ");
    expect(getHousehold("u1").name).toBe("The Okafor family");
    setHouseholdName("u1", "t1", "   ");
    expect(getHousehold("u1").name).toBeNull();
  });

  it("records a co-parent invite and exposes it as pending", () => {
    const r = addCoParentInvite("u1", "t1", "coparent@example.com");
    expect(r.ok).toBe(true);
    const view = getHousehold("u1");
    expect(view.invites).toHaveLength(1);
    expect(view.invites[0]).toMatchObject({ email: "coparent@example.com", status: "PENDING" });
  });

  it("does not duplicate a pending invite for the same email", () => {
    expect(addCoParentInvite("u1", "t1", "coparent@example.com").ok).toBe(true);
    const dupe = addCoParentInvite("u1", "t1", "coparent@example.com");
    expect(dupe.ok).toBe(false);
    if (!dupe.ok) expect(dupe.status).toBe(409);
    expect(getHousehold("u1").invites).toHaveLength(1);
  });

  it("isolates households by owner", () => {
    setHouseholdName("u1", "t1", "Family A");
    addCoParentInvite("u2", "t1", "b@example.com");
    expect(getHousehold("u1").name).toBe("Family A");
    expect(getHousehold("u1").invites).toHaveLength(0);
    expect(getHousehold("u2").name).toBeNull();
    expect(getHousehold("u2").invites).toHaveLength(1);
  });
});
