import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { registerChatRoutes } from "../src/routes/chat.js";

/**
 * Route-level integration test for hand-off (d): completing a live tutor
 * session must write a row into the `ef_session_outcomes` ledger, which is
 * what the parent/teacher "what's working" dashboards read. Exercises the real
 * POST /api/tutor/session/:id/complete handler against a fake drizzle db,
 * asserting both the session update AND the ledger insert land with the
 * derived signals.
 */
const SESSION_ID = "33333333-3333-3333-8333-333333333333";

interface Captured {
  updates: Record<string, unknown>[];
  inserts: Record<string, unknown>[];
}

function makeFakeDb(session: Record<string, unknown> | null, captured: Captured) {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return Promise.resolve(session ? [session] : []);
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          captured.updates.push(values);
          return {
            where() {
              return Promise.resolve(undefined);
            },
          };
        },
      };
    },
    insert() {
      return {
        values(v: Record<string, unknown>) {
          captured.inserts.push(v);
          return {
            returning() {
              return Promise.resolve([{ id: "ef_row_1", ...v }]);
            },
          };
        },
      };
    },
  };
}

describe("POST /api/tutor/session/:id/complete → ef_session_outcomes ledger", () => {
  let app: FastifyInstance;
  let captured: Captured;

  const session = {
    id: SESSION_ID,
    tenantId: "ten_1",
    learnerId: "lrn_1",
    tutorSku: "nova-standard",
    tutorName: "Nova",
    functioningLevel: "STANDARD",
    messages: [{ role: "user" }, { role: "assistant" }],
    brainContext: { preferred_modality: "visual", mastery_levels: {} },
    startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
  };

  before(async () => {
    captured = { updates: [], inserts: [] };
    app = Fastify({ logger: false });
    registerChatRoutes(app, makeFakeDb(session, captured));
    await app.ready();
  });

  it("writes a session update and one ledger row with derived signals", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/tutor/session/${SESSION_ID}/complete`,
      payload: {
        correctAnswers: 8,
        attemptedAnswers: 10,
        beatsTotal: 5,
        breaksUsed: 1,
        subject: "Math",
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "completed");

    // Session row updated with a completion timestamp.
    assert.equal(captured.updates.length, 1);
    assert.ok(captured.updates[0]!.completedAt instanceof Date);

    // Exactly one ledger row, carrying the derived outcome.
    assert.equal(captured.inserts.length, 1);
    const row = captured.inserts[0]!;
    assert.equal(row.learnerId, "lrn_1");
    assert.equal(row.tenantId, "ten_1");
    assert.equal(row.subject, "Math");
    assert.equal(row.modality, "visual"); // from brainContext.preferred_modality
    assert.equal(row.accuracy, 0.8); // 8/10
    assert.equal(row.frustrationRate, 0.2); // 1 break / 5 beats
    assert.equal(row.attentionMinutes, 10); // ~10 min duration
    assert.ok(typeof row.timeOfDay === "string" && row.timeOfDay.length > 0);
  });

  it("returns 404 (and writes nothing) for an unknown session", async () => {
    const localCaptured: Captured = { updates: [], inserts: [] };
    const localApp = Fastify({ logger: false });
    registerChatRoutes(localApp, makeFakeDb(null, localCaptured));
    await localApp.ready();

    const res = await localApp.inject({
      method: "POST",
      url: `/api/tutor/session/${SESSION_ID}/complete`,
      payload: {},
    });
    assert.equal(res.statusCode, 404);
    assert.equal(localCaptured.inserts.length, 0);
  });
});
