/**
 * Persistence adapter — smoke tests.
 *
 * The notifications domain is the first migrated through the adapter
 * (ADR 0007). These tests pin:
 *   - `getPersistence()` returns the memory adapter by default.
 *   - `notifications` list/markRead/create/listDeliveries go through
 *     the adapter and remain semantically identical to the legacy
 *     repo-direct implementations.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import {
  createLearner,
  createNotification,
  deleteLearner,
  findParentAssessment,
  findPrimaryParentForLearner,
  getLearner,
  getOrCreateParentAssessment,
  listAuditLogsForTenants,
  listDeliveriesFor,
  listLearnersForParent,
  listNotifications,
  markNotificationsRead,
  parentCanAccessLearner,
  patchParentAssessmentSection,
  recentAuditLogs,
  recordAudit,
  refreshLearnerReadiness,
  submitParentAssessment,
  updateLearner,
} from "@/lib/db/repos";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";

describe("persistence adapter — notifications (memory)", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("defaults to memory mode", () => {
    const p = getPersistence();
    expect(p.mode).toBe("memory");
  });

  it("create + list returns the inserted row", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Weekly snapshot",
      body: "Sky finished 3 lessons this week.",
      href: null,
      learnerId: null,
    });
    const all = await listNotifications({
      tenantId: "t_demo",
      userId: "u_demo_parent",
    });
    expect(all.some((n) => n.id === notification.id)).toBe(true);
  });

  it("listNotifications respects unreadOnly", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Unread one",
      body: ".",
      href: null,
      learnerId: null,
    });
    const before = await listNotifications({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      unreadOnly: true,
    });
    expect(before.some((n) => n.id === notification.id)).toBe(true);
    const flipped = await markNotificationsRead("u_demo_parent", "t_demo", [notification.id]);
    expect(flipped).toBe(1);
    const after = await listNotifications({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      unreadOnly: true,
    });
    expect(after.some((n) => n.id === notification.id)).toBe(false);
  });

  it("listDeliveriesFor returns one row per channel", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Delivery test",
      body: ".",
      href: null,
      learnerId: null,
    });
    const deliveries = await listDeliveriesFor(notification.id);
    // in_app, email, push are the three canonical channels.
    expect(deliveries.length).toBe(3);
  });

  it("audit append + recentForTenant round-trips", async () => {
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_demo",
      action: "test.audit.entry",
      requestId: "req-test-1",
    });
    const recent = await recentAuditLogs("t_demo", 50);
    expect(recent.some((l) => l.action === "test.audit.entry")).toBe(true);
  });

  it("audit recentForTenants filters by tenant set", async () => {
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_demo",
      action: "test.audit.scope.included",
      requestId: "req-test-2",
    });
    await recordAudit({
      userId: "u_demo_parent",
      tenantId: "t_other",
      action: "test.audit.scope.excluded",
      requestId: "req-test-3",
    });
    const scoped = await listAuditLogsForTenants(["t_demo"], 100);
    expect(scoped.some((l) => l.action === "test.audit.scope.included")).toBe(true);
    expect(scoped.some((l) => l.action === "test.audit.scope.excluded")).toBe(false);
  });

  it("learner create + getById round-trips through the adapter", async () => {
    const created = await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: {
        firstName: "Test",
        birthYear: new Date().getFullYear() - 8,
      },
    });
    const fetched = await getLearner(created.id, "t_demo");
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.firstName).toBe("Test");
  });

  it("parentCanAccessLearner rejects unrelated parent", async () => {
    const created = await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: { firstName: "Alpha", birthYear: 2018 },
    });
    expect(await parentCanAccessLearner("u_demo_parent", created.id, "t_demo")).toBe(true);
    expect(await parentCanAccessLearner("u_other", created.id, "t_demo")).toBe(false);
  });

  it("listLearnersForParent scopes to a single parent", async () => {
    await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: { firstName: "Solo", birthYear: 2017 },
    });
    const list = await listLearnersForParent("u_demo_parent", "t_demo");
    expect(list.some((l) => l.firstName === "Solo")).toBe(true);
    const otherList = await listLearnersForParent("u_other_parent", "t_demo");
    expect(otherList.some((l) => l.firstName === "Solo")).toBe(false);
  });

  it("update patches in place and recomputes displayName", async () => {
    const created = await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: { firstName: "Casey", birthYear: 2016 },
    });
    const updated = await updateLearner(created.id, "t_demo", { firstName: "Casey-Lee" });
    expect(updated?.firstName).toBe("Casey-Lee");
    expect(updated?.displayName).toBe("Casey-Lee");
  });

  it("delete cascades the parent/learner relationship", async () => {
    const created = await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: { firstName: "Doomed", birthYear: 2015 },
    });
    expect(await deleteLearner(created.id, "t_demo")).toBe(true);
    expect(await getLearner(created.id, "t_demo")).toBeNull();
    expect(await parentCanAccessLearner("u_demo_parent", created.id, "t_demo")).toBe(false);
  });

  it("findPrimaryParent returns the first relationship's parent", async () => {
    const created = await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: { firstName: "Linked", birthYear: 2015 },
    });
    const primary = await findPrimaryParentForLearner(created.id, "t_demo");
    expect(primary).toBe("u_demo_parent");
  });

  it("refreshLearnerReadiness returns a state for an existing learner", async () => {
    const created = await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: { firstName: "Fresh", birthYear: 2017 },
    });
    const state = await refreshLearnerReadiness(created.id, "t_demo");
    expect(state).not.toBeNull();
  });

  it("parent assessment: getOrCreate returns the same row twice", async () => {
    const a = await getOrCreateParentAssessment("lrn_demo_sky", "t_demo");
    const b = await getOrCreateParentAssessment("lrn_demo_sky", "t_demo");
    expect(a.id).toBe(b.id);
    expect(b.submittedAt).toBeNull();
  });

  it("parent assessment: patchSection accumulates completed sections", async () => {
    const updated = await patchParentAssessmentSection("lrn_demo_sky", "t_demo", "goals", {
      sample: "ok",
    });
    expect(updated.completedSections).toContain("goals");
    const refetched = await findParentAssessment("lrn_demo_sky", "t_demo");
    expect(refetched?.id).toBe(updated.id);
  });

  it("parent assessment: submit stamps submittedAt", async () => {
    await getOrCreateParentAssessment("lrn_demo_sky", "t_demo");
    const submitted = await submitParentAssessment("lrn_demo_sky", "t_demo");
    expect(submitted?.submittedAt).not.toBeNull();
  });

  it("brain profile: upsert + getForLearner round-trips", async () => {
    const learner = await createLearner({
      tenantId: "t_demo",
      parentUserId: "u_demo_parent",
      data: { firstName: "Brain", birthYear: 2016 },
    });
    const persistence = getPersistence();
    const profile = await persistence.brainProfiles.upsert({
      id: "brp-test-1",
      learnerId: learner.id,
      tenantId: "t_demo",
      // Cast: the persistence layer is shape-agnostic here; the
      // builder pipeline owns the state schema.
      state: { tutors: [] } as unknown as Parameters<
        typeof persistence.brainProfiles.upsert
      >[0]["state"],
      approvedByParent: false,
      approvalStatus: "pending_parent_review",
      cloneStage: "pre_clone",
      clonedAt: null,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const fetched = await persistence.brainProfiles.getForLearner(learner.id, "t_demo");
    expect(fetched?.id).toBe(profile.id);
  });

  it("lesson runs: upsert + getRunById + listForLearner round-trips", async () => {
    const persistence = getPersistence();
    const now = new Date().toISOString();
    const run = {
      id: "lr-test-1",
      tenantId: "t_demo",
      learnerId: "lrn_demo_sky",
      subjectId: "sub-x",
      skillId: "skl-x",
      source: "today_mission" as const,
      sourceRefId: null,
      tutorPersona: "Nimbus",
      learnerContextSnapshot: {} as never,
      masterySnapshot: {} as never,
      accommodationSnapshot: {} as never,
      brainStateSnapshot: {} as never,
      lessonPlanId: null,
      status: "ready" as const,
      retryCount: 0,
      failureReason: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await persistence.lessonRuns.upsertRun(run);
    const fetched = await persistence.lessonRuns.getRunById("lr-test-1", "t_demo");
    expect(fetched?.id).toBe("lr-test-1");
    const listed = await persistence.lessonRuns.listForLearner("lrn_demo_sky", "t_demo");
    expect(listed.some((r) => r.id === "lr-test-1")).toBe(true);
  });

  it("curriculum: listSubjects returns the seeded set", async () => {
    const subjects = await getPersistence().curriculum.listSubjects();
    expect(subjects.length).toBeGreaterThan(0);
  });

  it("curriculum: listSkills filters by subjectId", async () => {
    const subjects = await getPersistence().curriculum.listSubjects();
    const target = subjects[0]!;
    const inSubject = await getPersistence().curriculum.listSkills(target.id);
    for (const s of inSubject) expect(s.subjectId).toBe(target.id);
  });

  it("compliance: IEP upsert + getForLearner + delete round-trip", async () => {
    const compliance = getPersistence().compliance;
    const now = new Date().toISOString();
    const doc = {
      id: "iep-test-1",
      learnerId: "lrn_demo_sky",
      tenantId: "t_demo",
      fileName: "iep.pdf",
      mimeType: "application/pdf",
      bytes: 1234,
      uploadedAt: now,
      status: "pending" as const,
      extraction: null,
      acceptedAccommodations: null,
      confirmedAt: null,
    };
    await compliance.upsertIEP(doc);
    const fetched = await compliance.getIEPForLearner("lrn_demo_sky", "t_demo");
    expect(fetched?.id).toBe(doc.id);
    expect(await compliance.deleteIEP("lrn_demo_sky", "t_demo")).toBe(true);
    expect(await compliance.getIEPForLearner("lrn_demo_sky", "t_demo")).toBeNull();
  });

  it("compliance: getActiveConsentForUser respects revokedAt", async () => {
    const compliance = getPersistence().compliance;
    const tenantId = "t_demo";
    const parentUserId = "u_demo_parent";
    const now = new Date().toISOString();
    await compliance.upsertConsent({
      id: "c-active-1",
      tenantId,
      parentUserId,
      learnerId: null,
      consentType: "child_data_collection",
      version: "v1",
      acceptedAt: now,
      revokedAt: null,
      ipHash: null,
      userAgent: null,
    });
    const active = await compliance.getActiveConsentForUser(
      parentUserId,
      "child_data_collection",
      tenantId,
      null,
    );
    expect(active?.id).toBe("c-active-1");
    await compliance.upsertConsent({
      id: "c-active-1",
      tenantId,
      parentUserId,
      learnerId: null,
      consentType: "child_data_collection",
      version: "v1",
      acceptedAt: now,
      revokedAt: new Date().toISOString(),
      ipHash: null,
      userAgent: null,
    });
    const afterRevoke = await compliance.getActiveConsentForUser(
      parentUserId,
      "child_data_collection",
      tenantId,
      null,
    );
    expect(afterRevoke).toBeNull();
  });

  it("quests: progress upsert + getProgressForChapter round-trip", async () => {
    const quests = getPersistence().quests;
    const worlds = await quests.listWorlds();
    expect(worlds.length).toBeGreaterThan(0);
    const world = worlds[0]!;
    const chapters = await quests.listChaptersForWorld(world.id);
    expect(chapters.length).toBeGreaterThan(0);
    const chapter = chapters[0]!;
    const now = new Date().toISOString();
    await quests.upsertProgress({
      id: "qp-test-1",
      learnerId: "lrn_demo_sky",
      tenantId: "t_demo",
      questWorldId: world.id,
      chapterId: chapter.id,
      progress: 1,
      updatedAt: now,
    });
    const got = await quests.getProgressForChapter("lrn_demo_sky", "t_demo", chapter.id);
    expect(got?.progress).toBe(1);
  });

  it("admin: classroom upsert + listClassrooms by tenant", async () => {
    const admin = getPersistence().admin;
    const before = await admin.listClassrooms({ tenantId: "t_demo" });
    const now = new Date().toISOString();
    await admin.upsertClassroom({
      id: "cls-test-1",
      tenantId: "t_demo",
      schoolId: "school-test",
      name: "Adapter Test Class",
      gradeBand: "3" as never,
      teacherUserId: "user-test",
      courseId: null,
      createdAt: now,
    });
    const after = await admin.listClassrooms({ tenantId: "t_demo" });
    expect(after.length).toBe(before.length + 1);
    expect(after.some((c) => c.id === "cls-test-1")).toBe(true);
  });

  it("admin: teacher-assignment upsert + delete round-trip", async () => {
    const admin = getPersistence().admin;
    const now = new Date().toISOString();
    await admin.upsertTeacherAssignment({
      id: "ta-test-1",
      teacherId: "u_demo_teacher",
      tenantId: "t_demo",
      classId: null,
      title: "Adapter Test Assignment",
      instructions: "Please complete.",
      subjectId: "sub-x",
      skillIds: ["skl-x"],
      learnerIds: ["lrn_demo_sky"],
      status: "active",
      dueAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const fetched = await admin.getTeacherAssignmentById("ta-test-1", "u_demo_teacher", "t_demo");
    expect(fetched?.title).toBe("Adapter Test Assignment");
    expect(await admin.deleteTeacherAssignment("ta-test-1", "u_demo_teacher", "t_demo")).toBe(true);
    expect(
      await admin.getTeacherAssignmentById("ta-test-1", "u_demo_teacher", "t_demo"),
    ).toBeNull();
  });

  it("markNotificationsRead does not bleed across tenants", async () => {
    const { notification } = await createNotification({
      tenantId: "t_demo",
      userId: "u_demo_parent",
      type: "parent_progress_summary",
      title: "Scoped read",
      body: ".",
      href: null,
      learnerId: null,
    });
    const otherTenant = await markNotificationsRead("u_demo_parent", "t_some_other_tenant", [
      notification.id,
    ]);
    expect(otherTenant).toBe(0);
  });
});
