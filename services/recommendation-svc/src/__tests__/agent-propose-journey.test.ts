/**
 * Wave E (S11) — the agent proposal journey, end to end against the real
 * Fastify routes + in-memory store:
 *
 *   tutor agent proposes → PENDING (guardian-visible) → parent accepts
 *   → effect applied to the profile.
 *
 * Plus the three server-side guard rails a misbehaving (or compromised)
 * caller must hit: type policy, PENDING dedupe, and the 14-day cooldown.
 */
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  registerRecommendationRoutes,
  clearRecommendationStoreForTest,
  getProfileForTest,
} from "../routes/recommendations.js";
import {
  registerProposeRoute,
  PROPOSAL_COOLDOWN_DAYS,
  TUTOR_PROPOSABLE_TYPES,
} from "../routes/propose.js";

const LEARNER = "lrn-journey-1";

function proposeBody(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "ten-1",
    learnerId: LEARNER,
    tutorKey: "nova",
    sessionId: "sess-1",
    type: "tutor_strategy_change",
    title: "Use worked examples before practice",
    parentSummary:
      "Nova noticed that worked examples right before practice helped a lot this week — approving this makes them the default for math.",
    proposedValue: { strategy: "worked_example_first" },
    confidence: 0.7,
    evidenceSummary: "3 of 4 items solved after a worked example vs 1 of 4 without.",
    ...overrides,
  };
}

describe("agent propose → parent approve journey", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    clearRecommendationStoreForTest();
    app = Fastify({ logger: false });
    registerRecommendationRoutes(app);
    registerProposeRoute(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    clearRecommendationStoreForTest();
  });

  it("files a PENDING recommendation and a parent approval applies it", async () => {
    const proposed = await app.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody(),
    });
    expect(proposed.statusCode).toBe(201);
    const { recommendation } = proposed.json() as {
      recommendation: { id: string; status: string; evidence: Array<{ source: string }> };
    };
    expect(recommendation.status).toBe("PENDING");
    expect(recommendation.evidence[0].source).toBe("tutor_session");

    // Guardian-visible through the standard list route.
    const list = await app.inject({
      method: "GET",
      url: `/api/recommendations/learner/${LEARNER}?status=PENDING`,
    });
    expect(list.statusCode).toBe(200);
    expect(
      (list.json() as { recommendations: Array<{ id: string }> }).recommendations.map(
        (r) => r.id,
      ),
    ).toContain(recommendation.id);

    // Parent accepts through the existing decision route → APPLIED.
    const accepted = await app.inject({
      method: "POST",
      url: `/api/recommendations/${recommendation.id}/accept`,
      payload: { actorRole: "parent" },
    });
    expect(accepted.statusCode).toBe(200);
    const decided = accepted.json() as { recommendation: { status: string } };
    expect(["APPLIED", "APPROVED"]).toContain(decided.recommendation.status);

    // The effect actually landed on the learner profile.
    const profile = getProfileForTest(LEARNER) as { tutorStrategies?: unknown[] } & Record<
      string,
      unknown
    >;
    expect(JSON.stringify(profile)).toContain("worked_example_first");
  });

  it("refuses non-tutor-proposable types (functioning level stays human-initiated)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody({ type: "functioning_level_change", proposedValue: "SUPPORTED" }),
    });
    expect(res.statusCode).toBe(403);
    expect((res.json() as { allowedTypes: string[] }).allowedTypes).toEqual([
      ...TUTOR_PROPOSABLE_TYPES,
    ]);
  });

  it("dedupes against an existing PENDING of the same type", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody(),
    });
    expect(first.statusCode).toBe(201);
    const dup = await app.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody({ title: "Slightly different wording, same ask" }),
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: string }).error).toBe("duplicate_pending");
  });

  it("enforces the 14-day cooldown after a decision", async () => {
    // Re-register with a controllable clock.
    const clockApp = Fastify({ logger: false });
    let nowMs = Date.parse("2026-06-01T00:00:00.000Z");
    registerRecommendationRoutes(clockApp);
    registerProposeRoute(clockApp, { now: () => nowMs });
    await clockApp.ready();

    const first = await clockApp.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody(),
    });
    expect(first.statusCode).toBe(201);
    const { recommendation } = first.json() as { recommendation: { id: string } };
    // Parent declines — the proposal is no longer PENDING…
    const declined = await clockApp.inject({
      method: "POST",
      url: `/api/recommendations/${recommendation.id}/decline`,
      payload: { actorRole: "parent", reason: "not yet" },
    });
    expect(declined.statusCode).toBe(200);

    // …but a retry 5 days later still hits the cooldown.
    nowMs += 5 * 24 * 60 * 60 * 1000;
    const tooSoon = await clockApp.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody(),
    });
    expect(tooSoon.statusCode).toBe(429);
    const body = tooSoon.json() as { error: string; retryAfterDays: number };
    expect(body.error).toBe("cooldown");
    expect(body.retryAfterDays).toBe(PROPOSAL_COOLDOWN_DAYS - 5);

    // After the window it goes through again.
    nowMs += 10 * 24 * 60 * 60 * 1000;
    const afterWindow = await clockApp.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody(),
    });
    expect(afterWindow.statusCode).toBe(201);
    await clockApp.close();
  });

  it("rejects thin proposals parents could not decide from", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/propose",
      payload: proposeBody({ parentSummary: "do it" }),
    });
    expect(res.statusCode).toBe(422);
  });
});
