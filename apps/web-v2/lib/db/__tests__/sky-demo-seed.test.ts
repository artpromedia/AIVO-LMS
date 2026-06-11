/**
 * Wave F (S14) — the Sky demo-journey seed contract.
 *
 * With AIVO_SEED_DEMO_JOURNEY=1 (the dev-server/demo default), the seeded
 * mock learner must be a fully lived-in account: approved brain profile,
 * mastery map + learning path (so the mission picker can plan), completed
 * lessons with parent recaps (one carrying the agent tutor's note), and
 * readiness active_learning. The Playwright core journey (Part B) and
 * every demo login depend on this state actually materialising — a
 * silently-skipped brain profile here surfaces as `?blocker=generation`
 * in the real UI.
 */
import { beforeAll, describe, expect, it } from "vitest";

const SKY = "lrn_demo_sky";
const TENANT = "t_demo";

beforeAll(() => {
  process.env.AIVO_SEED_DEMO_JOURNEY = "1";
});

describe("Sky demo journey seed", () => {
  it("materialises the full journey state for the demo learner", async () => {
    const { getStore } = await import("@/lib/db/store");
    const { ensureSeeded } = await import("@/lib/db/seed");
    ensureSeeded();
    const store = getStore();

    const learner = store.learnerProfiles.get(SKY);
    expect(learner?.readinessState).toBe("active_learning");
    expect(learner?.iepDecision).toBe("skipped");

    // Submitted parent assessment + completed baseline with a summary.
    const assessment = Array.from(store.parentAssessments.values()).find(
      (a) => a.learnerId === SKY,
    );
    expect(assessment?.submittedAt).toBeTruthy();
    const baseline = store.baselineAssessments.get("bas_demo_sky");
    expect(baseline?.status).toBe("complete");
    expect(baseline?.summary).toBeTruthy();

    // The brain profile must parse the canonical schema AND be approved —
    // a schema rejection is silently skipped at seed time, so assert hard.
    const profile = store.brainProfiles.get("brp_demo_sky");
    expect(profile, "brain profile failed brainProfileStateSchema at seed time").toBeTruthy();
    expect(profile?.approvalStatus).toBe("approved");
    expect(profile?.cloneStage).toBe("cloned");

    // Mastery + path drive the mission picker.
    expect(store.masteryMaps.get("mm_demo_sky")).toBeTruthy();
    const masteries = store.skillMasteries.filter((m) => m.learnerId === SKY);
    expect(masteries.length).toBeGreaterThanOrEqual(6);
    const path = store.learningPaths.get("lp_demo_sky");
    expect(path?.nodes.length).toBeGreaterThanOrEqual(4);

    // Lesson history with parent recaps; one carries the agent tutor note.
    const runs = Array.from(store.lessonRuns.values()).filter(
      (r) => r.learnerId === SKY && r.status === "completed",
    );
    expect(runs.length).toBeGreaterThanOrEqual(2);
    const summaries = Array.from(store.parentLessonSummaries.values()).filter(
      (s) => s.learnerId === SKY,
    );
    expect(summaries.length).toBeGreaterThanOrEqual(2);
    expect(summaries.some((s) => Boolean(s.tutorNote))).toBe(true);

    // And the mission picker actually returns a playable mission…
    const { pickTodaysMission } = await import("@/lib/learner/today");
    const mission = await pickTodaysMission(SKY, TENANT);
    expect(mission.ready, `mission blocked: ${JSON.stringify(mission)}`).toBe(true);
    if (!mission.ready) return;

    // …and lesson generation for it succeeds (mock provider in tests/dev) —
    // this is the exact path behind the learner-home "Start Lesson" CTA.
    const { createLessonRun } = await import("@/lib/db/repos");
    const result = await createLessonRun({
      learnerId: SKY,
      tenantId: TENANT,
      subjectId: mission.mission.subjectId,
      skillId: mission.mission.skillId,
      source: mission.mission.source,
      sourceRefId: mission.mission.sourceRefId,
    });
    expect(
      result.ok,
      `createLessonRun failed: ${JSON.stringify("ok" in result && !result.ok ? result : null)}`,
    ).toBe(true);
  });
});
