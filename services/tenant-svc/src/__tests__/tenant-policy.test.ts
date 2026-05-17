import { describe, expect, it } from "vitest";
import {
  decideBrainMutationAccess,
  decideDistrictAnalyticsAccess,
  decideParentPrivateNoteAccess,
  decideRosterAccess,
} from "../services/tenant-policy.js";

describe("tenant policy", () => {
  it("parent retains brain mutation access", () => {
    expect(decideBrainMutationAccess("parent").allowed).toBe(true);
  });

  it("teacher cannot mutate brain", () => {
    expect(decideBrainMutationAccess("teacher").allowed).toBe(false);
  });

  it("district admin can view aggregate analytics", () => {
    expect(decideDistrictAnalyticsAccess("district_admin").allowed).toBe(true);
  });

  it("district admin cannot read parent private notes", () => {
    expect(decideParentPrivateNoteAccess("district_admin").allowed).toBe(false);
  });

  it("school admin cannot read parent private notes", () => {
    expect(decideParentPrivateNoteAccess("school_admin").allowed).toBe(false);
  });

  it("parent can read parent private notes", () => {
    expect(decideParentPrivateNoteAccess("parent").allowed).toBe(true);
  });

  it("parent cannot access roster import", () => {
    expect(decideRosterAccess("parent").allowed).toBe(false);
  });

  it("district admin can access roster import", () => {
    expect(decideRosterAccess("district_admin").allowed).toBe(true);
  });

  it("missing role rejects everything", () => {
    expect(decideRosterAccess(undefined).allowed).toBe(false);
    expect(decideDistrictAnalyticsAccess(undefined).allowed).toBe(false);
    expect(decideBrainMutationAccess(undefined).allowed).toBe(false);
  });
});
