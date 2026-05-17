import { describe, expect, it } from "vitest";
import {
  canAcceptDpa,
  canApproveProfileRecommendation,
  canExportDistrictCompliance,
  canManageDistrictHierarchy,
  canManageSchoolRoster,
  canMutateBrainGovernanceFields,
  canMutateLearnerProfile,
  canReadLearnerProfile,
  canReadParentPrivateNotes,
  canRunSisImport,
  canSubmitTeacherObservation,
  canViewClassLearners,
  canViewDistrictAnalytics,
} from "../role-policy.js";

describe("role policy", () => {
  it("parent can approve profile recommendations", () => {
    expect(canApproveProfileRecommendation("parent")).toBe(true);
  });

  it("teacher cannot approve profile recommendations", () => {
    expect(canApproveProfileRecommendation("teacher")).toBe(false);
  });

  it("district admin cannot approve profile recommendations", () => {
    expect(canApproveProfileRecommendation("district_admin")).toBe(false);
  });

  it("district admin cannot mutate learner profile", () => {
    expect(canMutateLearnerProfile("district_admin")).toBe(false);
  });

  it("teacher can submit observations", () => {
    expect(canSubmitTeacherObservation("teacher")).toBe(true);
  });

  it("teacher cannot mutate brain governance fields", () => {
    expect(canMutateBrainGovernanceFields("teacher")).toBe(false);
  });

  it("parent can mutate brain governance fields", () => {
    expect(canMutateBrainGovernanceFields("parent")).toBe(true);
  });

  it("learner cannot mutate brain governance fields", () => {
    expect(canMutateBrainGovernanceFields("learner")).toBe(false);
  });

  it("district admin can view district analytics", () => {
    expect(canViewDistrictAnalytics("district_admin")).toBe(true);
  });

  it("learner cannot view district analytics", () => {
    expect(canViewDistrictAnalytics("learner")).toBe(false);
  });

  it("district admin cannot read parent private notes", () => {
    expect(canReadParentPrivateNotes("district_admin")).toBe(false);
  });

  it("school admin cannot read parent private notes", () => {
    expect(canReadParentPrivateNotes("school_admin")).toBe(false);
  });

  it("parent can read parent private notes", () => {
    expect(canReadParentPrivateNotes("parent")).toBe(true);
  });

  it("returns false when role is undefined", () => {
    expect(canReadLearnerProfile(undefined)).toBe(false);
    expect(canApproveProfileRecommendation(undefined)).toBe(false);
    expect(canMutateLearnerProfile(undefined)).toBe(false);
  });
});

describe("district-mode role policy", () => {
  it("district admin can manage hierarchy", () => {
    expect(canManageDistrictHierarchy("district_admin")).toBe(true);
    expect(canManageDistrictHierarchy("school_admin")).toBe(false);
    expect(canManageDistrictHierarchy("teacher")).toBe(false);
  });

  it("school admin can manage roster but cannot manage hierarchy", () => {
    expect(canManageSchoolRoster("school_admin")).toBe(true);
    expect(canManageSchoolRoster("teacher")).toBe(false);
  });

  it("teacher can view class learners", () => {
    expect(canViewClassLearners("teacher")).toBe(true);
    expect(canViewClassLearners("parent")).toBe(false);
  });

  it("only district admin and platform admin can run SIS import", () => {
    expect(canRunSisImport("district_admin")).toBe(true);
    expect(canRunSisImport("platform_admin")).toBe(true);
    expect(canRunSisImport("school_admin")).toBe(false);
    expect(canRunSisImport("teacher")).toBe(false);
    expect(canRunSisImport("parent")).toBe(false);
  });

  it("only district admin can accept the DPA", () => {
    expect(canAcceptDpa("district_admin")).toBe(true);
    expect(canAcceptDpa("school_admin")).toBe(false);
    expect(canAcceptDpa("platform_admin")).toBe(false);
  });

  it("district admin can export compliance reports", () => {
    expect(canExportDistrictCompliance("district_admin")).toBe(true);
    expect(canExportDistrictCompliance("teacher")).toBe(false);
  });
});
