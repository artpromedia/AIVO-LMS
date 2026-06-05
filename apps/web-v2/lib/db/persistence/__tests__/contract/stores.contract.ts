/**
 * Shared contracts for the remaining domain stores. Each runs against
 * any implementation (memory + postgres). Assertions focus on the
 * semantics most likely to diverge between an array/Map and SQL:
 * ordering, tenant scoping, filters, upsert, cascade, and counts.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type {
  AuditLog,
  BaselineAssessment,
  BaselineAttempt,
  BaselineQuestion,
  Classroom,
  ConsentRecord,
  Enrollment,
  IEPDocument,
  LearningPath,
  Notification,
  NotificationDelivery,
  ParentAssessment,
  QuestProgress,
  TeacherAssignment,
} from "@/lib/db/types";
import type { ConsentType } from "@/lib/db/types";
import type {
  AdminStore,
  AssessmentStore,
  AuditStore,
  ComplianceStore,
  CurriculumStore,
  IdentityStore,
  LearnerStore,
  NotificationStore,
  QuestStore,
} from "../../types";

type Reset = () => void | Promise<void>;
const T = "t_1";

// ─── notifications ──────────────────────────────────────────────────
export function notificationStoreContract(
  label: string,
  make: () => NotificationStore,
  reset: Reset,
): void {
  const notif = (id: string, over: Partial<Notification> = {}): Notification =>
    ({
      id,
      tenantId: T,
      userId: "u_1",
      readAt: null,
      createdAt: `2026-01-0${id.slice(-1)}T00:00:00.000Z`,
      ...over,
    }) as unknown as Notification;

  describe(`NotificationStore contract — ${label}`, () => {
    let s: NotificationStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("lists newest-first, scopes by tenant+user, filters unread", async () => {
      await s.create({ notification: notif("n1"), deliveries: [] });
      await s.create({ notification: notif("n2"), deliveries: [] });
      const all = await s.list({ tenantId: T, userId: "u_1" });
      expect(all.map((n) => n.id)).toEqual(["n2", "n1"]);
      expect(await s.list({ tenantId: T, userId: "other" })).toEqual([]);
      await s.create({
        notification: notif("n3", { readAt: "2026-01-09T00:00:00.000Z" }),
        deliveries: [],
      });
      const unread = await s.list({ tenantId: T, userId: "u_1", unreadOnly: true });
      expect(unread.map((n) => n.id)).toEqual(["n2", "n1"]);
    });

    it("markRead flips only unread rows and returns the count", async () => {
      await s.create({ notification: notif("n1"), deliveries: [] });
      expect(await s.markRead({ tenantId: T, userId: "u_1", ids: ["n1", "missing"] })).toBe(1);
      expect(await s.markRead({ tenantId: T, userId: "u_1", ids: ["n1"] })).toBe(0);
      const [n] = await s.list({ tenantId: T, userId: "u_1" });
      expect(n.readAt).not.toBeNull();
    });

    it("stores + lists deliveries", async () => {
      const d = { id: "d1", notificationId: "n1" } as unknown as NotificationDelivery;
      await s.create({ notification: notif("n1"), deliveries: [d] });
      expect((await s.listDeliveries("n1")).map((x) => x.id)).toEqual(["d1"]);
    });
  });
}

// ─── audit ──────────────────────────────────────────────────────────
export function auditStoreContract(label: string, make: () => AuditStore, reset: Reset): void {
  const log = (id: string, tenantId: string | null): AuditLog =>
    ({ id, tenantId, action: "x" }) as unknown as AuditLog;

  describe(`AuditStore contract — ${label}`, () => {
    let s: AuditStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("is append-only, newest-first, capped, tenant-scoped", async () => {
      await s.append(log("a1", T));
      await s.append(log("a2", T));
      await s.append(log("a3", "t_2"));
      const recent = await s.recentForTenant(T, 10);
      expect((recent as unknown as { id: string }[]).map((l) => l.id)).toEqual(["a2", "a1"]);
      expect(await s.recentForTenant(T, 1)).toHaveLength(1);
      const multi = await s.recentForTenants([T, "t_2"], 10);
      expect((multi as unknown as { id: string }[]).map((l) => l.id)).toEqual(["a3", "a2", "a1"]);
    });
  });
}

// ─── identity ───────────────────────────────────────────────────────
export function identityStoreContract(
  label: string,
  make: () => IdentityStore,
  reset: Reset,
): void {
  describe(`IdentityStore contract — ${label}`, () => {
    let s: IdentityStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("adds staff users + memberships, looks them up, and removes with a tenant guard", async () => {
      const rec = await s.addStaffUser({
        tenantId: T,
        email: "t@e.com",
        displayName: "Zed",
        role: "TEACHER",
      });
      expect((await s.getUserById(rec.id))?.id).toBe(rec.id);
      const memberships = await s.listMembershipsForUser(rec.id);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]!.tenantId).toBe(T);
      const summaries = await s.listUsersForTenants([T]);
      expect(summaries.some((u) => u.user.id === rec.id)).toBe(true);

      const renamed = await s.updateUserDisplayName(rec.id, "Aaron");
      expect(renamed?.displayName).toBe("Aaron");

      expect(await s.removeStaffUser(rec.id, "wrong_tenant")).toBe(false);
      expect(await s.removeStaffUser(rec.id, T)).toBe(true);
      expect(await s.getUserById(rec.id)).toBeNull();
    });
  });
}

// ─── learners ───────────────────────────────────────────────────────
export function learnerStoreContract(label: string, make: () => LearnerStore, reset: Reset): void {
  const input = (firstName: string) =>
    ({ firstName, birthYear: 2017 }) as unknown as Parameters<LearnerStore["create"]>[0]["data"];

  describe(`LearnerStore contract — ${label}`, () => {
    let s: LearnerStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("creates, links the parent as primary, and scopes by tenant", async () => {
      const l = await s.create({ tenantId: T, parentUserId: "p_1", data: input("Sam") });
      expect((await s.getById(l.id, T))?.id).toBe(l.id);
      expect(await s.getById(l.id, "other")).toBeNull();
      expect((await s.listForParent("p_1", T)).map((x) => x.id)).toEqual([l.id]);
      expect(await s.parentCanAccess("p_1", l.id, T)).toBe(true);
      expect(await s.parentCanAccess("p_2", l.id, T)).toBe(false);
      expect(await s.findPrimaryParent(l.id, T)).toBe("p_1");
    });

    it("updates, sets readiness, and cascade-deletes", async () => {
      const l = await s.create({ tenantId: T, parentUserId: "p_1", data: input("Sam") });
      const updated = await s.update(l.id, T, { firstName: "Samuel" } as never);
      expect(updated?.firstName).toBe("Samuel");
      const ready = await s.setReadinessState(l.id, T, "baseline_pending" as never);
      expect(ready?.readinessState).toBe("baseline_pending");
      expect(await s.delete(l.id, T)).toBe(true);
      expect(await s.getById(l.id, T)).toBeNull();
      expect(await s.parentCanAccess("p_1", l.id, T)).toBe(false);
    });

    it("persists, reads back, and clears accessibility preferences (tenant-scoped)", async () => {
      const l = await s.create({ tenantId: T, parentUserId: "p_1", data: input("Sam") });
      // Unset until first write.
      expect(await s.getAccessibility(l.id, T)).toBeNull();

      const prefs = {
        learnerId: l.id,
        tenantId: T,
        reducedMotion: true,
        highContrast: false,
        largeText: true,
        dyslexiaFriendlyFont: true,
        visualSupports: false,
        audioFirst: false,
        captionsAlwaysOn: true,
        readAloud: false,
        hapticsEnabled: false,
        shorterSteps: false,
        extraHints: true,
        breakReminders: false,
        keyboardOptimized: false,
        aacEnabled: false,
        aacInputMethod: "touch",
        aacScanDelayMs: 1200,
        updatedAt: new Date().toISOString(),
      } as never;

      await s.setAccessibility(l.id, T, prefs);
      const read = await s.getAccessibility(l.id, T);
      expect(read?.reducedMotion).toBe(true);
      expect(read?.dyslexiaFriendlyFont).toBe(true);
      // Tenant isolation: another tenant sees nothing.
      expect(await s.getAccessibility(l.id, "other")).toBeNull();
      // Clearing restores the unset state (repo applies defaults).
      await s.setAccessibility(l.id, T, null);
      expect(await s.getAccessibility(l.id, T)).toBeNull();
    });
  });
}

// ─── assessments ────────────────────────────────────────────────────
export function assessmentStoreContract(
  label: string,
  make: () => AssessmentStore,
  reset: Reset,
): void {
  describe(`AssessmentStore contract — ${label}`, () => {
    let s: AssessmentStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("upserts parent + baseline assessments and picks the newest baseline", async () => {
      const pa = { id: "pa1", learnerId: "l1", tenantId: T } as unknown as ParentAssessment;
      await s.upsertParentAssessment(pa);
      expect((await s.findParentAssessment("l1", T))?.id).toBe("pa1");

      const b1 = {
        id: "b1",
        learnerId: "l1",
        tenantId: T,
        createdAt: "2026-01-01",
      } as unknown as BaselineAssessment;
      const b2 = {
        id: "b2",
        learnerId: "l1",
        tenantId: T,
        createdAt: "2026-01-03",
      } as unknown as BaselineAssessment;
      await s.upsertBaseline(b1);
      await s.upsertBaseline(b2);
      expect((await s.getBaselineById("b1", T))?.id).toBe("b1");
      expect(await s.getBaselineById("b1", "other")).toBeNull();
      expect((await s.getActiveBaselineForLearner("l1", T))?.id).toBe("b2");
    });

    it("sorts questions by order and keeps the latest attempt per (question, learner)", async () => {
      const q = (id: string, order: number) =>
        ({ id, baselineId: "b1", order }) as unknown as BaselineQuestion;
      await s.appendBaselineQuestions([q("q2", 2), q("q1", 1)]);
      expect((await s.listBaselineQuestions("b1")).map((x) => x.id)).toEqual(["q1", "q2"]);

      const attempt = (id: string) =>
        ({
          id,
          baselineId: "b1",
          tenantId: T,
          questionId: "q1",
          learnerId: "l1",
        }) as unknown as BaselineAttempt;
      await s.recordBaselineAttempt(attempt("at1"), { questionId: "q1", learnerId: "l1" });
      await s.recordBaselineAttempt(attempt("at2"), { questionId: "q1", learnerId: "l1" });
      const attempts = await s.listBaselineAttempts("b1", T);
      expect(attempts.map((a) => a.id)).toEqual(["at2"]);
    });
  });
}

// ─── curriculum ─────────────────────────────────────────────────────
export function curriculumStoreContract(
  label: string,
  make: () => CurriculumStore,
  reset: Reset,
): void {
  describe(`CurriculumStore contract — ${label}`, () => {
    let s: CurriculumStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("returns an empty mastery map for a fresh learner", async () => {
      const { map, skillMasteries } = await s.getMasteryMapForLearner("l1", T);
      expect(map).toBeNull();
      expect(skillMasteries).toEqual([]);
    });

    it("replaces the learning path atomically", async () => {
      const p1 = { id: "lp1", learnerId: "l1", tenantId: T } as unknown as LearningPath;
      const p2 = { id: "lp2", learnerId: "l1", tenantId: T } as unknown as LearningPath;
      await s.replaceLearningPath("l1", T, p1);
      expect((await s.getLearningPath("l1", T))?.id).toBe("lp1");
      await s.replaceLearningPath("l1", T, p2);
      expect((await s.getLearningPath("l1", T))?.id).toBe("lp2");
    });
  });
}

// ─── compliance ─────────────────────────────────────────────────────
export function complianceStoreContract(
  label: string,
  make: () => ComplianceStore,
  reset: Reset,
): void {
  const consent = (id: string, over: Partial<ConsentRecord> = {}): ConsentRecord =>
    ({
      id,
      parentUserId: "p_1",
      learnerId: null,
      tenantId: T,
      consentType: "data_processing" as ConsentType,
      revokedAt: null,
      acceptedAt: `2026-01-0${id.slice(-1)}T00:00:00.000Z`,
      ...over,
    }) as unknown as ConsentRecord;

  describe(`ComplianceStore contract — ${label}`, () => {
    let s: ComplianceStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("active consent: scope match, non-revoked, most-recent wins", async () => {
      await s.upsertConsent(consent("c1"));
      await s.upsertConsent(consent("c2"));
      await s.upsertConsent(consent("c3", { revokedAt: "2026-01-09T00:00:00.000Z" }));
      const active = await s.getActiveConsentForUser(
        "p_1",
        "data_processing" as ConsentType,
        T,
        null,
      );
      expect(active?.id).toBe("c2");
      // learner-scoped record does not match an account-wide query
      await s.upsertConsent(consent("c4", { learnerId: "l1" }));
      expect(
        (await s.getActiveConsentForUser("p_1", "data_processing" as ConsentType, T, null))?.id,
      ).toBe("c2");
      expect(
        (await s.getActiveConsentForUser("p_1", "data_processing" as ConsentType, T, "l1"))?.id,
      ).toBe("c4");
    });

    it("IEP + age gate round-trip and delete", async () => {
      const iep = { id: "iep1", learnerId: "l1", tenantId: T } as unknown as IEPDocument;
      await s.upsertIEP(iep);
      expect((await s.getIEPForLearner("l1", T))?.id).toBe("iep1");
      expect(await s.deleteIEP("l1", T)).toBe(true);
      expect(await s.getIEPForLearner("l1", T)).toBeNull();

      const gate = { learnerId: "l1", tenantId: T, verified: true } as never;
      await s.upsertAgeGate(gate);
      expect(await s.getAgeGateForLearner("l1", T)).not.toBeNull();
      expect(await s.getAgeGateForLearner("l1", "other")).toBeNull();
    });
  });
}

// ─── quests ─────────────────────────────────────────────────────────
export function questStoreContract(label: string, make: () => QuestStore, reset: Reset): void {
  const progress = (id: string, over: Partial<QuestProgress> = {}): QuestProgress =>
    ({
      id,
      learnerId: "l1",
      tenantId: T,
      questWorldId: "w1",
      chapterId: "ch1",
      ...over,
    }) as unknown as QuestProgress;

  describe(`QuestStore contract — ${label}`, () => {
    let s: QuestStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("upserts progress, scopes by learner+tenant and world, finds by chapter", async () => {
      await s.upsertProgress(progress("pr1"));
      await s.upsertProgress(progress("pr2", { questWorldId: "w2", chapterId: "ch2" }));
      expect((await s.listProgressForLearner("l1", T)).length).toBe(2);
      expect((await s.listProgressForLearner("l1", T, "w1")).map((p) => p.id)).toEqual(["pr1"]);
      expect(await s.listProgressForLearner("l1", "other")).toEqual([]);
      expect((await s.getProgressForChapter("l1", T, "ch2"))?.id).toBe("pr2");
    });
  });
}

// ─── admin ──────────────────────────────────────────────────────────
export function adminStoreContract(label: string, make: () => AdminStore, reset: Reset): void {
  describe(`AdminStore contract — ${label}`, () => {
    let s: AdminStore;
    beforeEach(async () => {
      await reset();
      s = make();
    });

    it("classrooms scope by tenant + teacher; enrollments find by natural key", async () => {
      const room = (id: string, teacherUserId: string): Classroom =>
        ({
          id,
          tenantId: T,
          schoolId: "sch1",
          teacherUserId,
          name: `Room ${id}`,
        }) as unknown as Classroom;
      await s.upsertClassroom(room("r1", "teach_1"));
      await s.upsertClassroom(room("r2", "teach_2"));
      expect(
        (await s.listClassrooms({ tenantId: T, teacherUserId: "teach_1" })).map((c) => c.id),
      ).toEqual(["r1"]);
      expect((await s.getClassroomById("r1", T))?.id).toBe("r1");
      expect(await s.getClassroomById("r1", "other")).toBeNull();

      const enr = {
        id: "e1",
        classroomId: "r1",
        tenantId: T,
        role: "learner",
        subjectId: "l1",
      } as unknown as Enrollment;
      await s.upsertEnrollment(enr);
      expect(
        (
          await s.findEnrollmentByNaturalKey({
            classroomId: "r1",
            subjectId: "l1",
            role: "learner",
          })
        )?.id,
      ).toBe("e1");
      expect(
        await s.findEnrollmentByNaturalKey({ classroomId: "r1", subjectId: "l1", role: "teacher" }),
      ).toBeNull();
    });

    it("teacher assignments: newest-first, status filter, scoped delete", async () => {
      const ta = (id: string, createdAt: string, status: string): TeacherAssignment =>
        ({
          id,
          teacherId: "teach_1",
          tenantId: T,
          status,
          createdAt,
        }) as unknown as TeacherAssignment;
      await s.upsertTeacherAssignment(ta("a1", "2026-01-01", "active"));
      await s.upsertTeacherAssignment(ta("a2", "2026-01-03", "archived"));
      expect((await s.listTeacherAssignments("teach_1", T)).map((a) => a.id)).toEqual(["a2", "a1"]);
      expect(
        (await s.listTeacherAssignments("teach_1", T, { status: "active" })).map((a) => a.id),
      ).toEqual(["a1"]);
      expect(await s.deleteTeacherAssignment("a1", "teach_1", T)).toBe(true);
      expect(await s.getTeacherAssignmentById("a1", "teach_1", T)).toBeNull();
    });
  });
}
