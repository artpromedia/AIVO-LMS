/**
 * Wave E (S9) — route-level tests for the agent session endpoints,
 * exercising the real Fastify handlers against a table-aware fake drizzle
 * db and a scripted ai-svc. Proves the wire contract the web BFF depends
 * on: open mints an `agent_lesson` session with initial agent state, turn
 * returns a decision AND persists state + trace, close stamps completion.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import {
  learners,
  tutorSessions,
  tutorDecisionTraces,
  tutorSessionEvidence,
  auditEvents,
} from "@aivo/db";
import { registerAgentSessionRoutes } from "../src/routes/agentSession.js";
import type { AiTurnResult } from "../src/agent/orchestrator.js";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const SESSION = "22222222-2222-4222-8222-222222222222";

interface Captured {
  sessionInserts: Record<string, unknown>[];
  sessionUpdates: Record<string, unknown>[];
  traceInserts: Record<string, unknown>[];
}

/** Minimal drizzle fake that routes by TABLE IDENTITY so one handler can
 *  serve learner lookups, session reads, and trace writes. */
function makeFakeDb(opts: {
  sessionRow: Record<string, unknown> | null;
  captured: Captured;
  traceRows?: Record<string, unknown>[];
  evidenceRows?: Record<string, unknown>[];
}) {
  return {
    select(_projection?: unknown) {
      return {
        from(table: unknown) {
          return {
            where() {
              if (table === learners) return Promise.resolve([{ tenantId: TENANT }]);
              if (table === tutorSessions) {
                return Promise.resolve(opts.sessionRow ? [opts.sessionRow] : []);
              }
              if (table === tutorDecisionTraces) return Promise.resolve(opts.traceRows ?? []);
              if (table === tutorSessionEvidence) {
                return Promise.resolve(opts.evidenceRows ?? []);
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(v: Record<string, unknown>) {
          if (table === tutorSessions) {
            opts.captured.sessionInserts.push(v);
            return {
              returning: () => Promise.resolve([{ id: SESSION, ...v }]),
            };
          }
          if (table === tutorDecisionTraces) {
            opts.captured.traceInserts.push(v);
            return Promise.resolve(undefined) as unknown as { returning: () => Promise<unknown[]> };
          }
          if (table === auditEvents) {
            return {
              returning: () => Promise.resolve([{ id: "audit-1", ...v }]),
            };
          }
          return { returning: () => Promise.resolve([v]) };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          if (table === tutorSessions) opts.captured.sessionUpdates.push(values);
          return { where: () => Promise.resolve(undefined) };
        },
      };
    },
  };
}

function makeApp(opts: {
  sessionRow: Record<string, unknown> | null;
  captured: Captured;
  aiScript: Array<AiTurnResult | Error>;
  traceRows?: Record<string, unknown>[];
  evidenceRows?: Record<string, unknown>[];
  composeParentNote?: (payload: Record<string, unknown>) => Promise<string | null>;
}): FastifyInstance {
  const app = Fastify({ logger: false });
  const script = [...opts.aiScript];
  registerAgentSessionRoutes(
    app,
    makeFakeDb(opts),
    {
      async callAiTurn() {
        const next = script.shift();
        if (!next) throw new Error("ai script exhausted");
        if (next instanceof Error) throw next;
        return next;
      },
      async fetchBrainContext() {
        return { functioning_level_profile: { level: "STANDARD" }, grade_band: "3" };
      },
      async getCurriculumFocus() {
        return null;
      },
    },
    { composeParentNote: opts.composeParentNote ?? (async () => null) },
  );
  return app;
}

const OBSERVATION = {
  beatIndex: 4,
  totalBeats: 7,
  beatKind: "guided",
  beatKinds: ["welcome", "goal", "micro", "example", "guided", "check", "celebrate"],
  prompt: "What is 3 + 4?",
  learnerResponse: "6",
  isCorrect: false,
  recentMissStreak: 1,
};

describe("POST /api/tutor/agent/session/open", () => {
  let captured: Captured;
  beforeEach(() => {
    captured = { sessionInserts: [], sessionUpdates: [], traceInserts: [] };
  });

  it("mints an agent_lesson session with initial agent state", async () => {
    const app = makeApp({ sessionRow: null, captured, aiScript: [] });
    const res = await app.inject({
      method: "POST",
      url: "/api/tutor/agent/session/open",
      payload: { learnerId: LEARNER, tutorKey: "nova", lessonRunId: "run-1", gradeBand: "3" },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Record<string, unknown>;
    assert.equal(body.sessionId, SESSION);
    assert.equal(body.tutorKey, "nova");
    assert.equal(body.negotiatedLevel, "STANDARD");
    assert.equal(body.rung, "full");

    assert.equal(captured.sessionInserts.length, 1);
    const inserted = captured.sessionInserts[0] as {
      sessionType: string;
      tutorSku: string;
      tutorName: string;
      agentState: {
        seq: number;
        tutorKey: string;
        envelope: { limit: number };
        ladder: { rung: string };
        lessonRunId: string;
        deliveryLevel: string;
      };
    };
    assert.equal(inserted.sessionType, "agent_lesson");
    assert.equal(inserted.tutorSku, "ADDON_TUTOR_MATH");
    assert.equal(inserted.tutorName, "Nova");
    assert.equal(inserted.agentState.seq, 0);
    assert.equal(inserted.agentState.tutorKey, "nova");
    assert.equal(inserted.agentState.envelope.limit, 8000);
    assert.equal(inserted.agentState.ladder.rung, "full");
    assert.equal(inserted.agentState.lessonRunId, "run-1");
    assert.equal(inserted.agentState.deliveryLevel, "3");
  });

  it("404s for an unknown tutor and 400s without a learner", async () => {
    const app = makeApp({ sessionRow: null, captured, aiScript: [] });
    const unknown = await app.inject({
      method: "POST",
      url: "/api/tutor/agent/session/open",
      payload: { learnerId: LEARNER, tutorKey: "zorp" },
    });
    assert.equal(unknown.statusCode, 404);
    const missing = await app.inject({
      method: "POST",
      url: "/api/tutor/agent/session/open",
      payload: { tutorKey: "nova" },
    });
    assert.equal(missing.statusCode, 400);
  });
});

describe("POST /api/tutor/agent/session/:sessionId/turn", () => {
  let captured: Captured;
  let sessionRow: Record<string, unknown>;
  beforeEach(() => {
    captured = { sessionInserts: [], sessionUpdates: [], traceInserts: [] };
    sessionRow = {
      id: SESSION,
      tenantId: TENANT,
      learnerId: LEARNER,
      tutorSku: "ADDON_TUTOR_MATH",
      sessionType: "agent_lesson",
      functioningLevel: "STANDARD",
      brainContext: { grade_band: "3" },
      agentState: {
        seq: 0,
        envelope: { limit: 8000, used: 0 },
        ladder: { rung: "full", latencies: [], consecutiveFailures: 0 },
        tutorKey: "nova",
        negotiatedLevel: "STANDARD",
        deliveryLevel: "3",
        lessonRunId: "run-1",
      },
      completedAt: null,
      startedAt: new Date(),
    };
  });

  it("returns the validated action and persists state + decision trace", async () => {
    const app = makeApp({
      sessionRow,
      captured,
      aiScript: [
        {
          kind: "action",
          action: { kind: "insert_scaffold", scaffold: "Count up from 3." },
          rationale: "miss on the same skill",
          usage: { prompt_tokens: 200, completion_tokens: 20 },
        },
      ],
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/tutor/agent/session/${SESSION}/turn`,
      payload: { learnerId: LEARNER, observation: OBSERVATION },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Record<string, unknown>;
    assert.equal(body.kind, "action");
    assert.equal((body.action as { kind: string }).kind, "insert_scaffold");
    assert.equal(body.effect, "insert_beat");
    assert.equal(body.seq, 1);

    assert.equal(captured.sessionUpdates.length, 1);
    const saved = captured.sessionUpdates[0] as {
      agentState: { seq: number; envelope: { used: number } };
    };
    assert.equal(saved.agentState.seq, 1);
    assert.equal(saved.agentState.envelope.used, 220);

    assert.equal(captured.traceInserts.length, 1);
    const trace = captured.traceInserts[0] as {
      decision: string;
      sessionId: string;
      seq: number;
    };
    assert.equal(trace.decision, "accepted:insert_scaffold");
    assert.equal(trace.sessionId, SESSION);
    assert.equal(trace.seq, 1);
  });

  it("400s on a malformed observation without touching the orchestrator", async () => {
    const app = makeApp({ sessionRow, captured, aiScript: [] });
    const res = await app.inject({
      method: "POST",
      url: `/api/tutor/agent/session/${SESSION}/turn`,
      payload: { learnerId: LEARNER, observation: { beatIndex: -1 } },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(captured.traceInserts.length, 0);
  });

  it("404s for a missing session and 403s for a learner mismatch", async () => {
    const appMissing = makeApp({ sessionRow: null, captured, aiScript: [] });
    const missing = await appMissing.inject({
      method: "POST",
      url: `/api/tutor/agent/session/${SESSION}/turn`,
      payload: { learnerId: LEARNER, observation: OBSERVATION },
    });
    assert.equal(missing.statusCode, 404);

    const appWrong = makeApp({ sessionRow, captured, aiScript: [] });
    const wrong = await appWrong.inject({
      method: "POST",
      url: `/api/tutor/agent/session/${SESSION}/turn`,
      payload: {
        learnerId: "44444444-4444-4444-8444-444444444444",
        observation: OBSERVATION,
      },
    });
    assert.equal(wrong.statusCode, 403);
  });
});

describe("POST /api/tutor/agent/session/:sessionId/close", () => {
  it("stamps completion once and is idempotent after", async () => {
    const captured: Captured = { sessionInserts: [], sessionUpdates: [], traceInserts: [] };
    const sessionRow: Record<string, unknown> = {
      id: SESSION,
      tenantId: TENANT,
      learnerId: LEARNER,
      sessionType: "agent_lesson",
      completedAt: null,
      startedAt: new Date(Date.now() - 5 * 60_000),
    };
    const app = makeApp({ sessionRow, captured, aiScript: [] });
    const res = await app.inject({
      method: "POST",
      url: `/api/tutor/agent/session/${SESSION}/close`,
      payload: { reason: "completed" },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as Record<string, unknown>;
    assert.equal(body.status, "closed");
    assert.ok(body.durationSeconds >= 299);
    assert.equal(captured.sessionUpdates.length, 1);
    assert.ok(captured.sessionUpdates[0].completedAt instanceof Date);

    sessionRow.completedAt = new Date();
    const again = await app.inject({
      method: "POST",
      url: `/api/tutor/agent/session/${SESSION}/close`,
      payload: {},
    });
    assert.equal(again.statusCode, 200);
    assert.equal((again.json() as { alreadyClosed?: boolean }).alreadyClosed, true);
    assert.equal(captured.sessionUpdates.length, 1, "no second update");
  });

  it("composes the parent note from the decision + evidence ledgers (S11)", async () => {
    const captured: Captured = { sessionInserts: [], sessionUpdates: [], traceInserts: [] };
    const composePayloads: Record<string, unknown>[] = [];
    const sessionRow: Record<string, unknown> = {
      id: SESSION,
      tenantId: TENANT,
      learnerId: LEARNER,
      sessionType: "agent_lesson",
      completedAt: null,
      startedAt: new Date(Date.now() - 8 * 60_000),
      agentState: {
        seq: 4,
        envelope: { limit: 8000, used: 1200 },
        ladder: { rung: "full", latencies: [], consecutiveFailures: 0 },
        tutorKey: "nova",
        negotiatedLevel: "STANDARD",
        deliveryLevel: "3",
        lessonRunId: "run-1",
        writes: { evidence: 1, proposals: 0 },
      },
    };
    const app = makeApp({
      sessionRow,
      captured,
      aiScript: [],
      traceRows: [
        { seq: 1, decision: "accepted:insert_scaffold" },
        { seq: 2, decision: "accepted:advance" },
        { seq: 3, decision: "accepted:offer_break" },
        { seq: 4, decision: "accepted:advance" },
      ],
      evidenceRows: [
        { note: "worked example helped on equal groups", skillId: "ccss.3.oa.a.1" },
      ],
      composeParentNote: async (payload) => {
        composePayloads.push(payload);
        return "Sky practised multiplication with Nova and a worked example helped.";
      },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/tutor/agent/session/${SESSION}/close`,
      payload: { reason: "completed", learnerFirstName: "Sky", checksCorrect: 2, checksTotal: 3 },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { parentNote: string | null };
    assert.equal(
      body.parentNote,
      "Sky practised multiplication with Nova and a worked example helped.",
    );
    assert.equal(composePayloads.length, 1);
    const digest = composePayloads[0].digest as {
      scaffolds_inserted: number;
      breaks_taken: number;
      checks_correct: number;
      evidence_notes: string[];
      focus_skills: string[];
    };
    assert.equal(digest.scaffolds_inserted, 1);
    assert.equal(digest.breaks_taken, 1);
    assert.equal(digest.checks_correct, 2);
    assert.deepEqual(digest.evidence_notes, ["worked example helped on equal groups"]);
    assert.deepEqual(digest.focus_skills, ["ccss.3.oa.a.1"]);
    assert.equal(composePayloads[0].learner_first_name, "Sky");
  });
});
