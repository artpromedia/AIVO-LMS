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
  listCaregiverObservations,
  listIepGoals,
  listSessionNotes,
  listTherapistCaseload,
  signSessionNote,
  updateIepGoalProgress,
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
});
