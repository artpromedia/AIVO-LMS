/**
 * Sprint 11 — teacher IEP-draft + gradebook repo tests.
 *
 * Pins the contract /api/bff/teacher/iep-drafts and /api/bff/teacher/
 * gradebook ride on:
 *   - upsertIepAiDraft round-trips and re-resets the lifecycle on
 *     regenerate
 *   - progressIepAiDraft enforces a strict state machine
 *   - getGradebookDetail returns level + attempts + lastPracticedIso
 *     for every mastered/secure/developing/introduced skill
 */
import { describe, expect, it, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore, getStore } from "@/lib/db/store";
import {
  getGradebookDetail,
  getIepAiDraft,
  listIepAiDraftsForReviewer,
  progressIepAiDraft,
  upsertIepAiDraft,
} from "@/lib/db/repos";
import type { IepAiDraftBody } from "@/lib/db/types";

const SAMPLE_DRAFT: IepAiDraftBody = {
  summary: "Strong math, low reading fluency.",
  goals: [
    {
      domain: "ela",
      goalText: "Will read 80 wpm with 95% accuracy.",
      baseline: "40 wpm",
      targetCriteria: "80 wpm",
      measurableCriteria: "Weekly DIBELS",
      evidence: ["baseline ela 2/6"],
    },
  ],
  accommodations: [
    {
      type: "presentation",
      description: "Visual supports for reading tasks",
      frequency: "always",
      rationale: "Visual modality 85%",
      priority: 1,
    },
  ],
  services: [],
  risks: [],
};

describe("upsertIepAiDraft", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("creates a new draft with ai_draft status", () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const learner = Array.from(getStore().learnerProfiles.values())[0]!;
    const out = upsertIepAiDraft({
      tenantId: tenant.id,
      learnerId: learner.id,
      draft: SAMPLE_DRAFT,
      model: "claude-sonnet-4-6",
    });
    expect(out.status).toBe("ai_draft");
    expect(out.draft.goals).toHaveLength(1);
    expect(out.model).toBe("claude-sonnet-4-6");

    expect(getIepAiDraft(learner.id, tenant.id)?.id).toBe(out.id);
  });

  it("upserts and resets the lifecycle on regenerate", () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const learner = Array.from(getStore().learnerProfiles.values())[0]!;
    const first = upsertIepAiDraft({
      tenantId: tenant.id,
      learnerId: learner.id,
      draft: SAMPLE_DRAFT,
    });
    progressIepAiDraft(first.id, tenant.id, "teacher-1", "teacher_review");
    // Regenerate.
    const second = upsertIepAiDraft({
      tenantId: tenant.id,
      learnerId: learner.id,
      draft: { ...SAMPLE_DRAFT, summary: "Updated summary." },
    });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("ai_draft");
    expect(second.reviewedByUserId).toBeNull();
    expect(second.draft.summary).toBe("Updated summary.");
  });
});

describe("progressIepAiDraft", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("enforces the lifecycle state machine", () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const learner = Array.from(getStore().learnerProfiles.values())[0]!;
    const draft = upsertIepAiDraft({
      tenantId: tenant.id,
      learnerId: learner.id,
      draft: SAMPLE_DRAFT,
    });

    // Illegal direct jump from ai_draft → admin_approved.
    expect(progressIepAiDraft(draft.id, tenant.id, "user-1", "admin_approved")).toBeNull();

    // Legal path: ai_draft → teacher_review → admin_approved → active.
    const r1 = progressIepAiDraft(draft.id, tenant.id, "teacher-1", "teacher_review");
    expect(r1?.status).toBe("teacher_review");
    expect(r1?.reviewedByUserId).toBe("teacher-1");
    const r2 = progressIepAiDraft(draft.id, tenant.id, "admin-1", "admin_approved");
    expect(r2?.status).toBe("admin_approved");
    expect(r2?.approvedByUserId).toBe("admin-1");
    const r3 = progressIepAiDraft(draft.id, tenant.id, "admin-1", "active");
    expect(r3?.status).toBe("active");

    // archived is terminal: nothing can move out of it.
    progressIepAiDraft(draft.id, tenant.id, "admin-1", "archived");
    expect(progressIepAiDraft(draft.id, tenant.id, "admin-1", "active")).toBeNull();
  });

  it("returns null on cross-tenant attempts", () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const learner = Array.from(getStore().learnerProfiles.values())[0]!;
    const draft = upsertIepAiDraft({
      tenantId: tenant.id,
      learnerId: learner.id,
      draft: SAMPLE_DRAFT,
    });
    expect(progressIepAiDraft(draft.id, "wrong-tenant", "x", "teacher_review")).toBeNull();
  });
});

describe("listIepAiDraftsForReviewer", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("returns drafts only for learners on the teacher's roster", () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const learner = Array.from(getStore().learnerProfiles.values())[0]!;
    upsertIepAiDraft({
      tenantId: tenant.id,
      learnerId: learner.id,
      draft: SAMPLE_DRAFT,
    });
    // Unknown teacher → no drafts visible.
    const out = listIepAiDraftsForReviewer("unknown-teacher", tenant.id);
    expect(out).toEqual([]);
  });
});

describe("getGradebookDetail", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("returns the per-skill mastery rows + summary", () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const learner = Array.from(getStore().learnerProfiles.values())[0]!;
    const detail = getGradebookDetail(learner.id, tenant.id);
    expect(detail.learnerId).toBe(learner.id);
    expect(typeof detail.summary.mastered).toBe("number");
    expect(typeof detail.summary.secure).toBe("number");
    // Summary numbers should sum to ≤ row count (rows can include
    // "unattempted" which is not in the summary).
    const totalLeveled =
      detail.summary.mastered +
      detail.summary.secure +
      detail.summary.developing +
      detail.summary.introduced;
    expect(totalLeveled).toBeLessThanOrEqual(detail.rows.length);
  });

  it("returns an empty rows array for a learner with no mastery yet", () => {
    const tenant = Array.from(getStore().tenants.values())[0]!;
    const detail = getGradebookDetail("nonexistent-learner", tenant.id);
    expect(detail.rows).toEqual([]);
  });
});
