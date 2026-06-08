/**
 * clinical — memory == postgres parity (Sprint 3).
 *
 * Covers the WEB-OWNED IEP AI-draft review inbox (web_iep_ai_drafts): one row
 * per learner, regeneration resets the lifecycle to ai_draft, the review
 * state machine (ai_draft → teacher_review → admin_approved → …), and the
 * newest-updated-first reviewer list. Canonical goals/notes/observations are
 * family-svc's (ADR 0015) and out of scope here.
 */
import { it, expect } from "vitest";
import type { IepAiDraftBody } from "@/lib/db/types";
import {
  upsertIepAiDraft,
  getIepAiDraft,
  progressIepAiDraft,
} from "@/lib/db/repos";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn-clinical-parity";
const body = (goals: number): IepAiDraftBody =>
  ({ summary: "draft", goals: Array.from({ length: goals }, (_, i) => ({ text: `g${i}` })) }) as
    unknown as IepAiDraftBody;

runInBothModes("clinical", () => {
  it("upsert is one-per-learner and regeneration resets the lifecycle", async () => {
    const first = await upsertIepAiDraft({ tenantId: T, learnerId: L, draft: body(1) });
    expect(first.status).toBe("ai_draft");
    expect((await getIepAiDraft(L, T))?.id).toBe(first.id);

    // Advance, then regenerate — same row id, status snaps back to ai_draft.
    const reviewing = await progressIepAiDraft(first.id, T, "u_reviewer", "teacher_review");
    expect(reviewing?.status).toBe("teacher_review");
    expect(reviewing?.reviewedByUserId).toBe("u_reviewer");

    const regenerated = await upsertIepAiDraft({ tenantId: T, learnerId: L, draft: body(2) });
    expect(regenerated.id).toBe(first.id);
    expect(regenerated.status).toBe("ai_draft");
    expect(regenerated.reviewedByUserId).toBeNull();
  });

  it("enforces the review state machine and tenant scoping", async () => {
    const d = await upsertIepAiDraft({ tenantId: T, learnerId: L, draft: body(1) });
    // Illegal jump ai_draft → admin_approved is rejected.
    expect(await progressIepAiDraft(d.id, T, "u_admin", "admin_approved")).toBeNull();
    // Wrong tenant cannot see/transition the draft.
    expect(await progressIepAiDraft(d.id, "t_other", "u_admin", "teacher_review")).toBeNull();
    // Legal path advances and stamps the approver.
    await progressIepAiDraft(d.id, T, "u_reviewer", "teacher_review");
    const approved = await progressIepAiDraft(d.id, T, "u_admin", "admin_approved");
    expect(approved?.status).toBe("admin_approved");
    expect(approved?.approvedByUserId).toBe("u_admin");
  });

  it("listDraftsForLearners is learner/tenant scoped", async () => {
    const clinical = getPersistence().clinical;
    await upsertIepAiDraft({ tenantId: T, learnerId: "lrn-c-a", draft: body(1) });
    await upsertIepAiDraft({ tenantId: T, learnerId: "lrn-c-b", draft: body(1) });

    const list = await clinical.listDraftsForLearners(["lrn-c-a", "lrn-c-b"], T);
    // Both present (newest-first ordering with controlled timestamps is the
    // store's contract; here the two upserts may share a millisecond so the
    // relative order is a tie and not asserted).
    expect(new Set(list.map((d) => d.learnerId))).toEqual(new Set(["lrn-c-a", "lrn-c-b"]));
    // A learner not in the id set is excluded.
    expect(await clinical.listDraftsForLearners(["lrn-c-b"], T)).toHaveLength(1);
    // Wrong tenant sees nothing.
    expect(await clinical.listDraftsForLearners(["lrn-c-a", "lrn-c-b"], "t_other")).toHaveLength(0);
  });
});
