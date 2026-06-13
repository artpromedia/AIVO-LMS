/**
 * Shared AssessmentStore submit/tenant contract (Sprint 1).
 *
 * Complements the broader assessmentStoreContract in stores.contract.ts by
 * pinning the semantics the parent-assessment save bug turned on:
 *   • upsert → read round-trip
 *   • submit stamps submittedAt and it survives the re-read
 *   • a second tenant can neither read nor silently overwrite the row
 *
 * Run against any implementation (memory now, postgres when a test DB is
 * available) so the drizzle adapter is proven equivalent to the in-memory
 * store. Import and call from a `*.test.ts`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type {
  ParentAssessment,
  TeacherAssessmentDraft,
  TherapistAssessmentDraft,
} from "@/lib/db/types";
import type { AssessmentStore } from "../../types";

const T = "t_1";

function tad(over: Partial<TeacherAssessmentDraft> = {}): TeacherAssessmentDraft {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "tad_c1",
    learnerId: "lrn_c1",
    tenantId: T,
    submittedByUserId: "tch_c1",
    answers: {},
    completedSections: [],
    startedAtMs: 1_700_000_000_000,
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
    ...over,
  };
}

function thad(over: Partial<TherapistAssessmentDraft> = {}): TherapistAssessmentDraft {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "thad_c1",
    learnerId: "lrn_c1",
    tenantId: T,
    submittedByUserId: "thr_c1",
    answers: {},
    completedSections: [],
    startedAtMs: 1_700_000_000_000,
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
    ...over,
  };
}

function pa(over: Partial<ParentAssessment> = {}): ParentAssessment {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "pa_c1",
    learnerId: "lrn_c1",
    tenantId: T,
    answers: {} as ParentAssessment["answers"],
    completedSections: [],
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
    ...over,
  };
}

export function assessmentSubmitContract(
  label: string,
  makeStore: () => AssessmentStore,
  reset: () => void | Promise<void>,
): void {
  describe(`AssessmentStore submit/tenant contract — ${label}`, () => {
    let store: AssessmentStore;

    beforeEach(async () => {
      await reset();
      store = makeStore();
    });

    it("round-trips an upserted parent assessment", async () => {
      await store.upsertParentAssessment(pa());
      const got = await store.findParentAssessment("lrn_c1", T);
      expect(got).not.toBeNull();
      expect(got!.id).toBe("pa_c1");
      expect(got!.submittedAt).toBeNull();
    });

    it("submit stamps submittedAt and it survives the re-read", async () => {
      await store.upsertParentAssessment(pa());
      await store.upsertParentAssessment(pa({ submittedAt: "2026-02-02T00:00:00.000Z" }));
      const got = await store.findParentAssessment("lrn_c1", T);
      expect(got!.submittedAt).toBe("2026-02-02T00:00:00.000Z");
    });

    it("accumulates completedSections across patches", async () => {
      await store.upsertParentAssessment(pa({ completedSections: ["goals"] }));
      await store.upsertParentAssessment(pa({ completedSections: ["goals", "reading"] }));
      const got = await store.findParentAssessment("lrn_c1", T);
      expect(got!.completedSections).toEqual(["goals", "reading"]);
    });

    it("scopes reads by tenant — a second tenant sees nothing", async () => {
      await store.upsertParentAssessment(pa());
      expect(await store.findParentAssessment("lrn_c1", "t_other")).toBeNull();
    });

    // ===== Teacher assessment DRAFT (Sprint C-07) =====

    it("round-trips an upserted teacher draft, keyed per teacher", async () => {
      await store.upsertTeacherAssessmentDraft(tad());
      const got = await store.findTeacherAssessmentDraft("lrn_c1", T, "tch_c1");
      expect(got).not.toBeNull();
      expect(got!.id).toBe("tad_c1");
      expect(got!.submittedAt).toBeNull();
    });

    it("accumulates teacher draft answers + completed sections across patches", async () => {
      await store.upsertTeacherAssessmentDraft(
        tad({ answers: { context: { teacherRole: "general_ed" } }, completedSections: ["context"] }),
      );
      await store.upsertTeacherAssessmentDraft(
        tad({
          answers: {
            context: { teacherRole: "general_ed" },
            strengths: { strengths: ["asks questions"] },
          },
          completedSections: ["context", "strengths"],
        }),
      );
      const got = await store.findTeacherAssessmentDraft("lrn_c1", T, "tch_c1");
      expect(got!.completedSections).toEqual(["context", "strengths"]);
      expect((got!.answers.strengths as { strengths: string[] }).strengths).toEqual([
        "asks questions",
      ]);
    });

    it("isolates teacher drafts by submitting teacher (co-teachers don't collide)", async () => {
      await store.upsertTeacherAssessmentDraft(tad({ id: "tad_a", submittedByUserId: "tch_a" }));
      await store.upsertTeacherAssessmentDraft(tad({ id: "tad_b", submittedByUserId: "tch_b" }));
      expect((await store.findTeacherAssessmentDraft("lrn_c1", T, "tch_a"))!.id).toBe("tad_a");
      expect((await store.findTeacherAssessmentDraft("lrn_c1", T, "tch_b"))!.id).toBe("tad_b");
    });

    it("scopes teacher draft reads by tenant — a second tenant sees nothing", async () => {
      await store.upsertTeacherAssessmentDraft(tad());
      expect(await store.findTeacherAssessmentDraft("lrn_c1", "t_other", "tch_c1")).toBeNull();
    });

    // ===== Therapist assessment DRAFT (Sprint C-10) =====

    it("round-trips an upserted therapist draft, keyed per therapist", async () => {
      await store.upsertTherapistAssessmentDraft(thad());
      const got = await store.findTherapistAssessmentDraft("lrn_c1", T, "thr_c1");
      expect(got).not.toBeNull();
      expect(got!.id).toBe("thad_c1");
      expect(got!.submittedAt).toBeNull();
    });

    it("persists the single-page therapist form payload across patches", async () => {
      await store.upsertTherapistAssessmentDraft(
        thad({ answers: { form: { therapyDiscipline: "speech" } }, completedSections: ["form"] }),
      );
      await store.upsertTherapistAssessmentDraft(
        thad({
          answers: { form: { therapyDiscipline: "speech", strengths: ["responds to modeling"] } },
          completedSections: ["form"],
        }),
      );
      const got = await store.findTherapistAssessmentDraft("lrn_c1", T, "thr_c1");
      expect(got!.completedSections).toEqual(["form"]);
      expect((got!.answers.form as { strengths: string[] }).strengths).toEqual([
        "responds to modeling",
      ]);
    });

    it("isolates therapist drafts by submitting therapist (co-treaters don't collide)", async () => {
      await store.upsertTherapistAssessmentDraft(thad({ id: "thad_a", submittedByUserId: "thr_a" }));
      await store.upsertTherapistAssessmentDraft(thad({ id: "thad_b", submittedByUserId: "thr_b" }));
      expect((await store.findTherapistAssessmentDraft("lrn_c1", T, "thr_a"))!.id).toBe("thad_a");
      expect((await store.findTherapistAssessmentDraft("lrn_c1", T, "thr_b"))!.id).toBe("thad_b");
    });

    it("scopes therapist draft reads by tenant — a second tenant sees nothing", async () => {
      await store.upsertTherapistAssessmentDraft(thad());
      expect(await store.findTherapistAssessmentDraft("lrn_c1", "t_other", "thr_c1")).toBeNull();
    });
  });
}
