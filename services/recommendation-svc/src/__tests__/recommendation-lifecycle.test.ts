/**
 * Phase 3 — end-to-end lifecycle over the persisted store.
 *
 * Before this change the candidates endpoint generated recommendations but
 * never persisted them, so a follow-up GET / accept always 404'd. These
 * tests exercise the wired store (the in-memory default shared by both route
 * modules) to prove the lifecycle now works: generate → retrieve → accept.
 */
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../server.js";
import { clearRecommendationStoreForTest } from "../routes/recommendations.js";

const SURFACE_SIGNALS = {
  learnerId: "learner-lifecycle-1",
  tenantId: "tenant-1",
  signals: [
    {
      source: "lesson",
      metric: "scratchpad_success_rate",
      value: 0.85,
      summary: "Scratchpad success rate is high.",
    },
    {
      source: "lesson",
      metric: "no_scratchpad_success_rate",
      value: 0.3,
      summary: "Success drops without scratchpad.",
    },
  ],
  currentProfile: {},
};

afterEach(() => {
  clearRecommendationStoreForTest();
});

describe("recommendation lifecycle (persisted store)", () => {
  it("persists generated candidates so they are retrievable + acceptable", async () => {
    const app = await buildApp({ skipAuth: true });
    try {
      const gen = await app.inject({
        method: "POST",
        url: "/api/recommendations/candidates",
        payload: SURFACE_SIGNALS,
      });
      expect(gen.statusCode).toBe(200);
      const { recommendations } = gen.json() as any;
      expect(recommendations).toHaveLength(1);
      const id = recommendations[0].id as string;

      // Previously this 404'd because candidates were never persisted.
      const got = await app.inject({ method: "GET", url: `/api/recommendations/${id}` });
      expect(got.statusCode).toBe(200);
      expect((got.json() as any).id).toBe(id);

      // Accept (parent-approved) → the record is updated in the store.
      const accepted = await app.inject({
        method: "POST",
        url: `/api/recommendations/${id}/accept`,
        payload: { actorRole: "parent" },
      });
      expect(accepted.statusCode).toBe(200);
      const body = accepted.json() as any;
      expect(["APPLIED", "FAILED"]).toContain(body.recommendation.status);

      // The updated status is persisted (re-fetch reflects it).
      const refetched = await app.inject({ method: "GET", url: `/api/recommendations/${id}` });
      expect((refetched.json() as any).status).toBe(body.recommendation.status);
    } finally {
      await app.close();
    }
  });

  it("rejects a non-parent actor on accept", async () => {
    const app = await buildApp({ skipAuth: true });
    try {
      const gen = await app.inject({
        method: "POST",
        url: "/api/recommendations/candidates",
        payload: SURFACE_SIGNALS,
      });
      const id = (gen.json() as any).recommendations[0].id as string;
      const res = await app.inject({
        method: "POST",
        url: `/api/recommendations/${id}/accept`,
        payload: { actorRole: "teacher" },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
