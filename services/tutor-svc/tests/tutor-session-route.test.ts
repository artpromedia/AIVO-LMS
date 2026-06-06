import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import type { ContentPack } from "@aivo/content-pack";
import { registerTutorSessionRoutes } from "../src/routes/tutorSession.js";

function makePack(skillId: string): ContentPack {
  return {
    id: "test-pack",
    title: "Test Pack",
    version: "1.0.0",
    schemaVersion: 1,
    subject: "math",
    gradeBand: "K",
    skillGraphRefs: ["ccss-math-k"],
    publisher: { name: "AIVO" },
    license: "Proprietary",
    publishedAt: "2026-01-01T00:00:00Z",
    assets: [],
    activities: [
      {
        id: "a1",
        title: "Tap one",
        skillId,
        type: "tap",
        prompt: "Tap once.",
        difficulty: "intro",
        choices: [{ id: "ok", label: "OK", correct: true }],
      },
      {
        id: "a2",
        title: "Tap one core",
        skillId,
        type: "multiple_choice",
        prompt: "Which is one?",
        difficulty: "core",
        choices: [
          { id: "1", label: "1", correct: true },
          { id: "2", label: "2", correct: false },
        ],
      },
    ],
  };
}

describe("tutor-svc generic plan route", () => {
  let app: FastifyInstance;
  before(async () => {
    app = Fastify({ logger: false });
    registerTutorSessionRoutes(app);
    await app.ready();
  });

  it("GET /api/tutors lists every catalog tutor", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tutors" });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { tutors: Array<{ key: string }> };
    const keys = body.tutors.map((t) => t.key).sort();
    // 14 catalog tutors (Nova + 13).
    assert.equal(keys.length, 14);
    for (const required of [
      "nova",
      "sage",
      "spark",
      "chrono",
      "pixel",
      "echo",
      "harmony",
      "atlas",
      "cadence",
      "vigor",
      "lingua",
      "forge",
      "compass",
      "muse",
    ]) {
      assert.ok(keys.includes(required), `catalog missing "${required}"`);
    }
  });

  it("GET /api/tutors/:key returns the definition", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tutors/sage" });
    assert.equal(res.statusCode, 200);
    const def = res.json() as { persona: { id: string }; subjects: string[] };
    assert.equal(def.persona.id, "sage");
    assert.deepEqual(def.subjects, ["ela", "writing"]);
  });

  it("GET /api/tutors/:key 404s on unknown tutor", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tutors/not-a-tutor" });
    assert.equal(res.statusCode, 404);
  });

  it("POST /api/tutors/:key/plan rejects when learnerId missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/nova/plan",
      payload: { contentPack: makePack("ccss.math.k.cc.a.1") },
    });
    assert.equal(res.statusCode, 400);
  });

  it("POST /api/tutors/:key/plan enforces consent gate when policy requires it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/harmony/plan",
      payload: {
        learnerId: "l1",
        contentPack: makePack("casel.k2.self_awareness.feelings"),
      },
    });
    assert.equal(res.statusCode, 403);
    const body = res.json() as { code: string };
    assert.equal(body.code, "consent_missing");
  });

  it("POST /api/tutors/:key/plan returns a SessionPlan when inputs are valid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/nova/plan",
      payload: {
        learnerId: "l1",
        consentRecordId: "c1",
        contentPack: makePack("ccss.math.k.cc.a.1"),
        masteryRecords: [],
        recentOutcomes: [],
        maxActivities: 4,
      },
    });
    assert.equal(res.statusCode, 200);
    const plan = res.json() as {
      tutorDefinitionId: string;
      learnerId: string;
      activities: Array<{ id: string }>;
      aiSvcPersonaKey: string;
    };
    assert.equal(plan.tutorDefinitionId, "math-coach@1.0.0");
    assert.equal(plan.learnerId, "l1");
    assert.equal(plan.aiSvcPersonaKey, "ADDON_TUTOR_MATH");
    assert.ok(plan.activities.length > 0);
  });

  it("POST /api/tutors/:key/plan negotiates unsupported functioning levels", async () => {
    // Lingua does NOT declare PRE_SYMBOLIC; the negotiator should
    // step down and the runtime should still produce a plan.
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/lingua/plan",
      payload: {
        learnerId: "l1",
        consentRecordId: "c1",
        functioningLevel: "PRE_SYMBOLIC",
        contentPack: {
          ...makePack("actfl.nl.com.greet"),
          subject: "world_languages",
          gradeBand: "6",
          skillGraphRefs: ["actfl-world-languages-novice-low"],
        },
      },
    });
    assert.equal(res.statusCode, 200);
    const plan = res.json() as { functioningLevel: string };
    // Lingua supports STANDARD/SUPPORTED/LOW_VERBAL/NON_VERBAL — the
    // negotiator should land on NON_VERBAL (closest to PRE_SYMBOLIC).
    assert.equal(plan.functioningLevel, "NON_VERBAL");
  });

  it("POST /api/tutors/:key/plan 404s on unknown tutor", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/not-a-tutor/plan",
      payload: { learnerId: "l1", contentPack: makePack("x") },
    });
    assert.equal(res.statusCode, 404);
  });

  it("POST /api/tutors/:key/plan 409s on a scaffold band by default", async () => {
    // chrono declares 3-12 with every band as `scaffold` (AI-draft) —
    // production env should refuse to plan a session.
    const prev = process.env.AIVO_ALLOW_SCAFFOLD_CONTENT;
    delete process.env.AIVO_ALLOW_SCAFFOLD_CONTENT;
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/tutors/chrono/plan",
        payload: {
          learnerId: "l1",
          consentRecordId: "c1",
          gradeBand: "PRE_K",
          contentPack: makePack("c3.5.D2.His.3"),
        },
      });
      assert.equal(res.statusCode, 409);
      const body = res.json() as Record<string, unknown>;
      assert.equal(body.code, "grade_band_not_production");
      assert.equal(body.authoringInProgress, true);
      assert.equal(body.gradeBand, "PRE_K");
    } finally {
      if (prev !== undefined) process.env.AIVO_ALLOW_SCAFFOLD_CONTENT = prev;
    }
  });

  it("POST /api/tutors/:key/plan allows scaffold when AIVO_ALLOW_SCAFFOLD_CONTENT=true", async () => {
    const prev = process.env.AIVO_ALLOW_SCAFFOLD_CONTENT;
    process.env.AIVO_ALLOW_SCAFFOLD_CONTENT = "true";
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/tutors/chrono/plan",
        payload: {
          learnerId: "l1",
          consentRecordId: "c1",
          gradeBand: "5",
          contentPack: makePack("c3.5.D2.His.3"),
        },
      });
      assert.equal(res.statusCode, 200);
    } finally {
      if (prev === undefined) delete process.env.AIVO_ALLOW_SCAFFOLD_CONTENT;
      else process.env.AIVO_ALLOW_SCAFFOLD_CONTENT = prev;
    }
  });

  it("POST /api/tutors/:key/plan succeeds for an authored band without scaffold opt-in", async () => {
    // nova K is `authored` — production should serve it normally.
    const prev = process.env.AIVO_ALLOW_SCAFFOLD_CONTENT;
    delete process.env.AIVO_ALLOW_SCAFFOLD_CONTENT;
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/tutors/nova/plan",
        payload: {
          learnerId: "l1",
          consentRecordId: "c1",
          gradeBand: "K",
          contentPack: makePack("ccss-math.K.CC.A.1"),
        },
      });
      assert.equal(res.statusCode, 200);
    } finally {
      if (prev !== undefined) process.env.AIVO_ALLOW_SCAFFOLD_CONTENT = prev;
    }
  });

  it("POST /api/tutors/:key/plan ignores gradeBand when omitted (backward compat)", async () => {
    // Existing callers that don't pass gradeBand should still work —
    // the gate only fires when the field is present.
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/chrono/plan",
      payload: {
        learnerId: "l1",
        consentRecordId: "c1",
        contentPack: makePack("c3.5.D2.His.3"),
      },
    });
    assert.equal(res.statusCode, 200);
  });
});
