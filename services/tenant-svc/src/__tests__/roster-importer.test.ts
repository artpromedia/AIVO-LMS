import { describe, expect, it } from "vitest";
import { createRosterImporterStores, importRoster } from "../services/roster-importer.js";

const SAMPLE = {
  districtId: "d1",
  schools: [{ externalId: "s1", name: "Acme Elementary" }],
  teachers: [
    {
      externalId: "t1",
      givenName: "T",
      familyName: "One",
      schoolExternalIds: ["s1"],
    },
  ],
  students: [
    {
      externalId: "stu1",
      givenName: "Alice",
      familyName: "Smith",
      schoolExternalId: "s1",
    },
  ],
  classes: [
    {
      externalId: "c1",
      name: "Grade 3 Math",
      schoolExternalId: "s1",
      teacherExternalIds: ["t1"],
    },
  ],
  enrollments: [{ classExternalId: "c1", studentExternalId: "stu1" }],
};

describe("importRoster", () => {
  it("upserts classes and enrollments", () => {
    const stores = createRosterImporterStores();
    const result = importRoster(SAMPLE, stores);
    expect(result.classesUpserted).toBe(1);
    expect(result.enrollmentsUpserted).toBe(1);
    expect(stores.classRecords.has("c1")).toBe(true);
  });

  it("preserves parent-owned profile fields on existing students", () => {
    const stores = createRosterImporterStores();
    stores.existingStudents.set("stu1", {
      externalId: "stu1",
      parentOwnedFields: {
        activeAccommodations: ["extended_time"],
      },
    });
    const result = importRoster(SAMPLE, stores);
    expect(result.preservedParentOwnedFields).toBe(true);
    expect(
      (stores.existingStudents.get("stu1")?.parentOwnedFields as Record<string, unknown>)
        .activeAccommodations,
    ).toEqual(["extended_time"]);
  });

  it("flags teacher with unknown school as a warning", () => {
    const stores = createRosterImporterStores();
    const result = importRoster(
      {
        ...SAMPLE,
        teachers: [{ ...SAMPLE.teachers[0], schoolExternalIds: ["ghost-school"] }],
      },
      stores,
    );
    expect(result.warnings.some((w) => w.includes("ghost-school"))).toBe(true);
  });

  it("idempotently upserts the same enrollment", () => {
    const stores = createRosterImporterStores();
    const first = importRoster(SAMPLE, stores);
    const second = importRoster(SAMPLE, stores);
    expect(first.enrollmentsUpserted).toBe(1);
    expect(second.enrollmentsUpserted).toBe(0);
  });
});
