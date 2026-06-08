/**
 * admin — memory == postgres parity (Sprint 1).
 * Classroom upsert/list-by-tenant + teacher-assignment upsert/get/delete.
 */
import { it, expect } from "vitest";
import type { Classroom, TeacherAssignment } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";

runInBothModes("admin", () => {
  it("upsertClassroom + listClassrooms scopes by tenant", async () => {
    const admin = getPersistence().admin;
    const before = await admin.listClassrooms({ tenantId: T });
    await admin.upsertClassroom({
      id: "cls-parity-1",
      tenantId: T,
      schoolId: "school-x",
      name: "Parity Class",
      gradeBand: "3",
      teacherUserId: "u_demo_teacher",
      courseId: null,
      createdAt: new Date().toISOString(),
    } as unknown as Classroom);
    const after = await admin.listClassrooms({ tenantId: T });
    expect(after.length).toBe(before.length + 1);
    expect(after.some((c) => c.id === "cls-parity-1")).toBe(true);
    expect((await admin.listClassrooms({ tenantId: "t_other" })).some((c) => c.id === "cls-parity-1")).toBe(
      false,
    );
  });

  it("teacher-assignment upsert/get/delete round-trips", async () => {
    const admin = getPersistence().admin;
    const now = new Date().toISOString();
    await admin.upsertTeacherAssignment({
      id: "ta-parity-1",
      teacherId: "u_demo_teacher",
      tenantId: T,
      classId: null,
      title: "Parity Assignment",
      instructions: "Do it.",
      subjectId: "sub-x",
      skillIds: ["skl-x"],
      learnerIds: ["lrn_demo_sky"],
      status: "active",
      dueAt: null,
      createdAt: now,
      updatedAt: now,
    } as unknown as TeacherAssignment);
    expect(
      (await admin.getTeacherAssignmentById("ta-parity-1", "u_demo_teacher", T))?.title,
    ).toBe("Parity Assignment");
    expect(await admin.deleteTeacherAssignment("ta-parity-1", "u_demo_teacher", T)).toBe(true);
    expect(await admin.getTeacherAssignmentById("ta-parity-1", "u_demo_teacher", T)).toBeNull();
  });
});
