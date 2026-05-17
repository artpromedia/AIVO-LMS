import { describe, expect, it } from "vitest";
import { NormalizedExportSisProvider } from "../services/sis-provider-interface.js";
import { createCleverAdapterFromExport } from "../services/clever-adapter.js";
import { createClassLinkAdapterFromExport } from "../services/classlink-adapter.js";

const SAMPLE = {
  schools: [{ externalId: "s1", name: "Sample Elementary" }],
  teachers: [{ externalId: "t1", givenName: "T", familyName: "One", schoolExternalIds: ["s1"] }],
  students: [{ externalId: "stu1", givenName: "A", familyName: "B", schoolExternalId: "s1" }],
  classes: [
    { externalId: "c1", name: "Class A", schoolExternalId: "s1", teacherExternalIds: ["t1"] },
  ],
  enrollments: [{ classExternalId: "c1", studentExternalId: "stu1" }],
};

describe("Sis provider interface", () => {
  it("normalized export exposes all five lists", async () => {
    const provider = new NormalizedExportSisProvider("test", SAMPLE);
    expect((await provider.listSchools())[0].externalId).toBe("s1");
    expect((await provider.listTeachers())[0].externalId).toBe("t1");
    expect((await provider.listStudents())[0].externalId).toBe("stu1");
    expect((await provider.listClasses())[0].externalId).toBe("c1");
    expect((await provider.listEnrollments())[0].classExternalId).toBe("c1");
  });

  it("clever adapter names itself clever", () => {
    const provider = createCleverAdapterFromExport(SAMPLE);
    expect(provider.name).toBe("clever");
  });

  it("classlink adapter names itself classlink", () => {
    const provider = createClassLinkAdapterFromExport(SAMPLE);
    expect(provider.name).toBe("classlink");
  });
});
