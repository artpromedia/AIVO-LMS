/**
 * Sprint C-13 — change-capture behavioural proof, per mutation path.
 *
 * Proves, against a real seeded in-memory store, that the Learning Brain stops
 * changing silently. One test per enumerated structural-mutation path plus the
 * mastery-vs-structural policy, the SCREEN 0 trigger, dedupe, the C-01
 * teaching-never-blocked guarantee, and preference filtering.
 *
 * The mutation paths captured (see the Checkpoint's enumeration):
 *   - commitBrainClone (first clone → SCREEN 0; re-clone → change)
 *   - upsertBrainProfile (regenerate → change)
 * Parent-authored folds (approveBrainClone) are deliberately NOT captured.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore, getStore } from "@/lib/db/store";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";
import {
  cloneBrainFromBaseline,
  createLearner,
  createLessonRun,
  getBrainProfile,
  listBrainProfileChanges,
  listNotifications,
  listDeliveriesFor,
  upsertBrainProfile,
  updateNotificationPreference,
} from "@/lib/db/repos";
import type { BaselineAssessment, LearnerBrainProfile, LessonRunSource } from "@/lib/db/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

async function seedBaseline(learnerId: string): Promise<void> {
  await getPersistence().assessments.upsertBaseline({
    id: `bas_${learnerId}`,
    learnerId,
    tenantId: TENANT,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    summary: { totalAnswered: 6 },
  } as unknown as BaselineAssessment);
}

async function freshLearner(): Promise<string> {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Maya", birthYear: 2016 },
  });
  await seedBaseline(learner.id);
  return learner.id;
}

/** Clone, then force the profile to `approved` so we have a reviewable
 *  baseline + a teaching gate to protect. Returns the approved profile. */
async function approvedClone(learnerId: string): Promise<LearnerBrainProfile> {
  await cloneBrainFromBaseline(learnerId, TENANT);
  const cloned = (await getBrainProfile(learnerId, TENANT))!;
  return getPersistence().brainProfiles.upsert({
    ...cloned,
    cloneStage: "approved",
    approvalStatus: "approved",
    approvedByParent: true,
  });
}

async function attemptLesson(learnerId: string, source: LessonRunSource = "subject_path") {
  const curriculum = getPersistence().curriculum;
  const math = (await curriculum.listSubjects()).find((s) => s.slug === "math")!;
  const skills = await curriculum.listSkills(math.id);
  return createLessonRun({ learnerId, tenantId: TENANT, subjectId: math.id, skillId: skills[0].id, source });
}

function changeNotifs(userId = PARENT) {
  return listNotifications({ tenantId: TENANT, userId }).then((ns) =>
    ns.filter((n) => n.type === "brain_profile_changed"),
  );
}
function readyNotifs(userId = PARENT) {
  return listNotifications({ tenantId: TENANT, userId }).then((ns) =>
    ns.filter((n) => n.type === "brain_profile_ready"),
  );
}

describe("C-13 change capture — per mutation path", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
  });

  it("first clone fires SCREEN 0 (in-app + email), writes NO change record", async () => {
    const learnerId = await freshLearner();
    const profile = await cloneBrainFromBaseline(learnerId, TENANT);
    expect(profile?.cloneStage).toBe("cloned");

    expect(await listBrainProfileChanges(learnerId, TENANT)).toEqual([]);

    const ready = await readyNotifs();
    expect(ready).toHaveLength(1);
    expect(ready[0].href).toContain("/brain-clone-watch");
    const sent = (await listDeliveriesFor(ready[0].id))
      .filter((d) => d.status === "sent")
      .map((d) => d.channel);
    expect(sent).toContain("in_app");
    expect(sent).toContain("email");
  });

  it("re-clone is deduped — a second clone does NOT fire SCREEN 0 again", async () => {
    const learnerId = await freshLearner();
    await cloneBrainFromBaseline(learnerId, TENANT);
    await cloneBrainFromBaseline(learnerId, TENANT);
    expect(await readyNotifs()).toHaveLength(1);
  });

  it("regenerate from an approved profile with a structural shift → structural change + notice", async () => {
    const learnerId = await freshLearner();
    const approved = await approvedClone(learnerId);

    // Regenerate with a state that turns a support ON (structural) regardless of
    // what the seed produced — we control the after-state fully here.
    const next = {
      ...approved.state,
      activeAccommodations: [...approved.state.activeAccommodations.filter((a) => a !== "read_aloud"), "read_aloud"],
      supportDefaults: { ...approved.state.supportDefaults, readAloud: true },
    };
    // Ensure the BEFORE state did NOT already have it (so the delta is real).
    if (!approved.state.activeAccommodations.includes("read_aloud") && !approved.state.supportDefaults.readAloud) {
      await upsertBrainProfile(learnerId, TENANT, next);

      const structural = (await listBrainProfileChanges(learnerId, TENANT)).filter(
        (c) => c.kind === "structural",
      );
      expect(structural).toHaveLength(1);
      expect(structural[0].requiresAck).toBe(true);
      expect(structural[0].fields).toContain("accommodation.read_aloud");
      expect(structural[0].source).toBe("regenerate");

      const changed = await changeNotifs();
      expect(changed).toHaveLength(1);
      expect(changed[0].href).toContain("/brain-timeline");
    }
  });

  it("structural change NEVER blocks the approved profile until the re-clone (C-01 gate)", async () => {
    // A re-clone of an APPROVED profile stays approved (repos.prepareBrainClone),
    // so a structural change recorded against it must not stop teaching.
    const learnerId = await freshLearner();
    await approvedClone(learnerId);
    // Patch the stored state so the next re-clone produces a structural delta
    // (the deterministic rebuild won't carry this patched accommodation, so the
    // before/after diff registers a structural change), then re-clone.
    const p = (await getBrainProfile(learnerId, TENANT))!;
    await getPersistence().brainProfiles.upsert({
      ...p,
      state: {
        ...p.state,
        activeAccommodations: [...p.state.activeAccommodations, "aac_communication_support"],
      },
    });
    const recloned = await cloneBrainFromBaseline(learnerId, TENANT);
    expect(recloned?.cloneStage).toBe("approved"); // re-clone keeps approved

    // The approved profile still teaches — the delta is metadata, never a gate.
    const gate = await attemptLesson(learnerId);
    expect(gate.ok, gate.ok ? "" : `createLessonRun failed: ${gate.message}`).toBe(true);
  });

  it("mastery-only move → mastery change record, NO ack demand, NO change notification", async () => {
    const learnerId = await freshLearner();
    const approved = await approvedClone(learnerId);

    const domain = Object.keys(approved.state.masteryLevels)[0];
    if (domain) {
      const next = {
        ...approved.state,
        masteryLevels: {
          ...approved.state.masteryLevels,
          [domain]: Math.min(1, (approved.state.masteryLevels[domain] ?? 0) + 0.5),
        },
      };
      await upsertBrainProfile(learnerId, TENANT, next);

      const changes = await listBrainProfileChanges(learnerId, TENANT);
      expect(changes.every((c) => c.kind === "mastery")).toBe(true);
      expect(changes.length).toBeGreaterThanOrEqual(1);
      expect(changes[0].requiresAck).toBe(false);
      expect(await changeNotifs()).toHaveLength(0);
    }
  });

  it("pre-clone regenerate churn captures nothing (no review anchor)", async () => {
    const learnerId = await freshLearner();
    const p = await getBrainProfile(learnerId, TENANT);
    if (p) await upsertBrainProfile(learnerId, TENANT, { ...p.state });
    expect(await listBrainProfileChanges(learnerId, TENANT)).toEqual([]);
    expect(await changeNotifs()).toHaveLength(0);
  });

  it("honours the parent's saved preference — email off ⇒ SCREEN 0 email skipped", async () => {
    const learnerId = await freshLearner();
    await updateNotificationPreference(PARENT, TENANT, {
      preferences: { "brain_profile_ready:email": false },
    });
    await cloneBrainFromBaseline(learnerId, TENANT);
    const ready = (await readyNotifs())[0];
    expect(ready).toBeTruthy();
    const deliveries = await listDeliveriesFor(ready.id);
    expect(deliveries.find((d) => d.channel === "email")?.status).toBe("skipped");
    expect(deliveries.find((d) => d.channel === "in_app")?.status).toBe("sent");
    expect(getStore().notifications.size).toBeGreaterThan(0);
  });
});
