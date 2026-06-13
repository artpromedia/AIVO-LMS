/**
 * Sprint 9 / 10 — therapist + caregiver repos.
 *
 * Pins the contract the new BFF routes ride on: IEP goals,
 * session-note SOAP shape, signing, progress trending, and caregiver
 * observation authoring.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore, getStore } from "@/lib/db/store";
import {
  createCaregiverObservation,
  createIepGoal,
  createSessionNote,
  getOrCreateTherapistAssessmentDraft,
  patchTherapistAssessmentForm,
  findTherapistAssessmentDraft,
  markTherapistAssessmentDraftSubmitted,
  updateCaregiverObservation,
  listCaregiverObservations,
  listIepGoals,
  listSessionNotes,
  listTherapistCaseload,
  signSessionNote,
  updateIepGoalProgress,
  CAREGIVER_EDIT_WINDOW_MS,
} from "@/lib/db/repos";

describe("IEP goals", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("creates a goal with active status and zero progress", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const goal = createIepGoal({
      tenantId,
      learnerId,
      authoredByUserId: "user-1",
      domain: "speech",
      goalText: "Will produce /r/ in initial position in 4 of 5 trials.",
    });
    expect(goal.status).toBe("active");
    expect(goal.progressPct).toBe(0);
    expect(listIepGoals(learnerId, tenantId)).toContainEqual(goal);
  });

  it("updateIepGoalProgress clamps 0-100 and auto-flips to 'met' at 100", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const goal = createIepGoal({
      tenantId,
      learnerId,
      authoredByUserId: "user-1",
      domain: "ela",
      goalText: "Will read 80 wpm with 95% accuracy.",
    });
    const updated = updateIepGoalProgress(goal.id, tenantId, 250, "note-a");
    expect(updated?.progressPct).toBe(100);
    expect(updated?.status).toBe("met");
    expect(updated?.dataPoints).toHaveLength(1);
    const partial = updateIepGoalProgress(goal.id, tenantId, 40);
    expect(partial?.progressPct).toBe(40);
    // Stays "met" — once met, the team must manually re-open the goal.
    expect(partial?.status).toBe("met");
  });

  it("rejects cross-tenant progress updates", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const goal = createIepGoal({
      tenantId,
      learnerId,
      authoredByUserId: "user-1",
      domain: "ela",
      goalText: "x",
    });
    expect(updateIepGoalProgress(goal.id, "other-tenant", 50)).toBeNull();
  });
});

describe("therapist session notes", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("creates a SOAP-templated note and lists it newest-first", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const note1 = createSessionNote({
      tenantId,
      learnerId,
      therapistUserId: "th-1",
      sessionDate: "2026-05-20T10:00:00Z",
      durationMinutes: 30,
      subjective: "Learner reported feeling calm.",
      objective: "10 trials of /r/, 6 correct.",
      assessment: "On target for goal #1.",
      plan: "Same drill next session.",
      goalIds: [],
    });
    const note2 = createSessionNote({
      tenantId,
      learnerId,
      therapistUserId: "th-1",
      sessionDate: "2026-05-22T10:00:00Z",
      durationMinutes: 30,
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      goalIds: [],
    });
    const listed = listSessionNotes(learnerId, tenantId);
    expect(listed[0].id).toBe(note2.id);
    expect(listed[1].id).toBe(note1.id);
    expect(note1.signedAt).toBeNull();
  });

  it("signSessionNote stamps signedAt", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const note = createSessionNote({
      tenantId,
      learnerId,
      therapistUserId: "th-1",
      durationMinutes: 25,
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
      goalIds: [],
    });
    const signed = signSessionNote(note.id, tenantId);
    expect(signed?.signedAt).not.toBeNull();
    expect(signSessionNote(note.id, "wrong-tenant")).toBeNull();
  });
});

describe("listTherapistCaseload", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("returns an empty list when the therapist has no accepted invites", async () => {
    const tenantId = Array.from(getStore().tenants.values())[0]!.id;
    const out = await listTherapistCaseload("nonexistent-user", "nobody@example.com", tenantId);
    expect(out).toEqual([]);
  });
});

describe("caregiver observations", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("creates an observation and surfaces it on the learner feed", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const obs = createCaregiverObservation({
      tenantId,
      learnerId,
      caregiverUserId: "cg-1",
      behaviour: "Refused dinner",
      antecedent: "Was asked to come to the table",
      consequence: "Cried for 5 minutes",
      durationMinutes: 5,
      location: "home",
    });
    expect(obs.behaviour).toBe("Refused dinner");
    expect(obs.location).toBe("home");
    const feed = listCaregiverObservations(learnerId, tenantId);
    expect(feed[0].id).toBe(obs.id);
  });

  // Sprint C-10: mood round-trip — mood persists end-to-end through the store.
  it("persists an optional mood end-to-end", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const obs = createCaregiverObservation({
      tenantId,
      learnerId,
      caregiverUserId: "cg-1",
      behaviour: "Sat calmly through reading",
      mood: "calm",
    });
    expect(obs.mood).toBe("calm");
    const feed = listCaregiverObservations(learnerId, tenantId);
    expect(feed.find((o) => o.id === obs.id)?.mood).toBe("calm");
  });

  it("defaults mood to null when not provided", () => {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const obs = createCaregiverObservation({
      tenantId,
      learnerId,
      caregiverUserId: "cg-1",
      behaviour: "x",
    });
    expect(obs.mood).toBeNull();
    expect(obs.updatedAt).toBeNull();
    expect(obs.editHistory).toEqual([]);
  });
});

// Sprint C-10: author-only edit within the 15-minute window, with a
// history trace and a hard non-author 403 (Trust rule). The window is driven
// by an injected clock so expiry is deterministic.
describe("caregiver observation edit window", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  function seedObs() {
    const store = getStore();
    const tenantId = Array.from(store.tenants.values())[0]!.id;
    const learnerId = Array.from(store.learnerProfiles.values())[0]!.id;
    const obs = createCaregiverObservation({
      tenantId,
      learnerId,
      caregiverUserId: "cg-author",
      behaviour: "Refused dinner",
      mood: "frustrated",
    });
    return { tenantId, learnerId, obs };
  }

  it("lets the author edit within the window and snapshots the prior text", () => {
    const { tenantId, obs } = seedObs();
    const createdMs = new Date(obs.createdAt).getTime();
    const res = updateCaregiverObservation(
      {
        id: obs.id,
        tenantId,
        editorUserId: "cg-author",
        behaviour: "Refused dinner, then ate after a break",
        mood: "calm",
      },
      createdMs + 60_000, // 1 minute later — inside the window
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.observation.behaviour).toBe("Refused dinner, then ate after a break");
    expect(res.observation.mood).toBe("calm");
    expect(res.observation.updatedAt).not.toBeNull();
    // History preserves the prior values — never a silent overwrite.
    expect(res.observation.editHistory).toHaveLength(1);
    expect(res.observation.editHistory[0].behaviour).toBe("Refused dinner");
    expect(res.observation.editHistory[0].mood).toBe("frustrated");
  });

  it("forbids a non-author from editing (403 semantics)", () => {
    const { tenantId, obs } = seedObs();
    const res = updateCaregiverObservation({
      id: obs.id,
      tenantId,
      editorUserId: "cg-stranger",
      behaviour: "tampered",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("forbidden");
    // The stored row is untouched.
    expect(listCaregiverObservations(obs.learnerId, tenantId)[0].behaviour).toBe("Refused dinner");
  });

  it("rejects an edit after the 15-minute window expires", () => {
    const { tenantId, obs } = seedObs();
    const createdMs = new Date(obs.createdAt).getTime();
    const res = updateCaregiverObservation(
      { id: obs.id, tenantId, editorUserId: "cg-author", behaviour: "too late" },
      createdMs + CAREGIVER_EDIT_WINDOW_MS + 1, // just past expiry
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("window_expired");
  });

  it("returns not_found for an unknown id / cross-tenant access", () => {
    const { obs } = seedObs();
    expect(updateCaregiverObservation({ id: obs.id, tenantId: "other", editorUserId: "cg-author" }).ok).toBe(
      false,
    );
    expect(updateCaregiverObservation({ id: "missing", tenantId: "t", editorUserId: "x" }).ok).toBe(false);
  });
});

// Sprint C-10: therapist assessment autosave DRAFT — restore-after-kill +
// per-therapist isolation + submit stamping. Memory store (the parity with the
// drizzle store is proven by the shared assessments contract).
describe("therapist assessment draft", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("get-or-create returns a stable draft and autosave restores it after a 'tab kill'", async () => {
    const tenantId = Array.from(getStore().tenants.values())[0]!.id;
    const learnerId = Array.from(getStore().learnerProfiles.values())[0]!.id;

    const draft = await getOrCreateTherapistAssessmentDraft(learnerId, tenantId, "thr-1");
    expect(draft.submittedAt).toBeNull();

    // Autosave half the form.
    await patchTherapistAssessmentForm(learnerId, tenantId, "thr-1", {
      therapyDiscipline: "speech",
      strengths: ["responds to modeling"],
    });

    // Simulate a tab kill + reload: a fresh read returns the persisted draft.
    const restored = await findTherapistAssessmentDraft(learnerId, tenantId, "thr-1");
    expect(restored).not.toBeNull();
    expect(restored!.id).toBe(draft.id);
    expect(restored!.completedSections).toEqual(["form"]);
    expect((restored!.answers.form as { strengths: string[] }).strengths).toEqual([
      "responds to modeling",
    ]);
  });

  it("keeps separate drafts per therapist on the same learner", async () => {
    const tenantId = Array.from(getStore().tenants.values())[0]!.id;
    const learnerId = Array.from(getStore().learnerProfiles.values())[0]!.id;
    await patchTherapistAssessmentForm(learnerId, tenantId, "thr-a", { therapyDiscipline: "speech" });
    await patchTherapistAssessmentForm(learnerId, tenantId, "thr-b", {
      therapyDiscipline: "occupational",
    });
    const a = await findTherapistAssessmentDraft(learnerId, tenantId, "thr-a");
    const b = await findTherapistAssessmentDraft(learnerId, tenantId, "thr-b");
    expect((a!.answers.form as { therapyDiscipline: string }).therapyDiscipline).toBe("speech");
    expect((b!.answers.form as { therapyDiscipline: string }).therapyDiscipline).toBe(
      "occupational",
    );
  });

  it("markSubmitted stamps submittedAt and is tenant-scoped", async () => {
    const tenantId = Array.from(getStore().tenants.values())[0]!.id;
    const learnerId = Array.from(getStore().learnerProfiles.values())[0]!.id;
    await getOrCreateTherapistAssessmentDraft(learnerId, tenantId, "thr-1");
    const submitted = await markTherapistAssessmentDraftSubmitted(learnerId, tenantId, "thr-1");
    expect(submitted?.submittedAt).not.toBeNull();
    // A wrong tenant has no draft to stamp.
    expect(await markTherapistAssessmentDraftSubmitted(learnerId, "other-tenant", "thr-1")).toBeNull();
  });
});
