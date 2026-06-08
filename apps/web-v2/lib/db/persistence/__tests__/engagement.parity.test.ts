/**
 * engagement / sessions / notification-prefs — memory == postgres parity
 * (Sprint 8 remainder).
 *
 * Homework-help sessions (create → message append → complete, with tenant
 * scoping + completed-no-op), calm sessions, the per-learner sensory profile
 * (modality merge), and notification preferences (create-on-read default +
 * patch).
 */
import { it, expect } from "vitest";
import {
  createHomeworkSession,
  getHomeworkSession,
  listHomeworkSessionsForLearner,
  appendHomeworkMessage,
  completeHomeworkSession,
  recordCalmSession,
  listCalmSessionsForLearner,
  getLearnerSensoryProfile,
  upsertLearnerSensoryModality,
  getNotificationPreference,
  updateNotificationPreference,
} from "@/lib/db/repos";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky"; // seeded learner (for the sensory tenant-isolation check)

runInBothModes("engagement", () => {
  it("homework session: create → append → complete, tenant-scoped", async () => {
    const s = await createHomeworkSession({ learnerId: L, tenantId: T, topic: "Fractions", subjectId: null });
    expect((await getHomeworkSession(s.id, T))?.id).toBe(s.id);
    expect(await getHomeworkSession(s.id, "t_wrong")).toBeNull();

    const withMsg = await appendHomeworkMessage(s.id, T, { role: "learner", text: "help" } as never);
    expect(withMsg?.messages.length).toBe(1);

    const done = await completeHomeworkSession(s.id, T, "Great work!");
    expect(done?.endedAt).not.toBeNull();
    // completed sessions are append-only no-ops
    const after = await appendHomeworkMessage(s.id, T, { role: "tutor", text: "more" } as never);
    expect(after?.messages.length).toBe(1);

    expect((await listHomeworkSessionsForLearner(L, T)).some((x) => x.id === s.id)).toBe(true);
  });

  it("calm session record + learner/tenant-scoped list", async () => {
    await recordCalmSession({ tenantId: T, learnerId: L, activityId: "breathe", activityKind: "breathing", completed: true, secondsSpent: 60 });
    expect((await listCalmSessionsForLearner(L, T)).length).toBeGreaterThanOrEqual(1);
    expect((await listCalmSessionsForLearner(L, "t_wrong")).length).toBe(0);
  });

  it("sensory profile: modality upsert merges + tenant-isolation", async () => {
    const p1 = await upsertLearnerSensoryModality(L, T, "auditory" as never, "hyper" as never, "loud rooms");
    expect((p1.modalities as Record<string, string>).auditory).toBe("hyper");
    const p2 = await upsertLearnerSensoryModality(L, T, "visual" as never, "hypo" as never);
    expect((p2.modalities as Record<string, string>).auditory).toBe("hyper"); // preserved
    expect((p2.modalities as Record<string, string>).visual).toBe("hypo");
    expect((await getLearnerSensoryProfile(L, T))?.notes).toBe("loud rooms");
    expect(await getLearnerSensoryProfile(L, "t_wrong")).toBeNull();
  });

  it("notification preference: create-on-read default + patch persists", async () => {
    expect(await getPersistence().notifications.getPreference("u_np_x")).toBeNull();
    const def = await getNotificationPreference("u_np_x", T);
    expect(def.digestCadence).toBe("weekly");
    const updated = await updateNotificationPreference("u_np_x", T, { digestCadence: "daily" as never });
    expect(updated.digestCadence).toBe("daily");
    expect((await getNotificationPreference("u_np_x", T)).digestCadence).toBe("daily");
  });
});
