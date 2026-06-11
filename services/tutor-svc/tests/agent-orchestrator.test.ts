/**
 * Wave E (S9) — AgentOrchestrator unit tests with faked deps.
 *
 * The orchestrator must: gate on the ladder rung and the token envelope
 * BEFORE any model call, execute read-tool roundtrips, validate every
 * proposed action through the SessionMachine mirror, persist a decision
 * trace for every path (accepted / rejected / fallback / skipped), and
 * never throw for model or transport trouble.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  AgentOrchestrator,
  initialAgentState,
  observationDigest,
  buildMachineMirror,
  type AgentSessionRow,
  type AgentSessionState,
  type AiTurnResult,
  type DecisionTraceInput,
  type LessonObservation,
} from "../src/agent/orchestrator.js";
import { parseObservation } from "../src/routes/agentSession.js";
import { getTutorDefinition } from "../src/modes/registry.js";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";

function makeObservation(overrides: Partial<LessonObservation> = {}): LessonObservation {
  return {
    beatIndex: 5,
    totalBeats: 8,
    beatKind: "guided",
    beatKinds: ["welcome", "goal", "micro", "example", "guided", "guided", "check", "celebrate"],
    prompt: "What is 3 + 4?",
    learnerResponse: "6",
    isCorrect: false,
    expectedAnswer: "7",
    attemptsOnBeat: 2,
    hintsUsed: 1,
    recentMissStreak: 2,
    skillId: "ccss.3.oa.a.1",
    ...overrides,
  };
}

interface Harness {
  orchestrator: AgentOrchestrator;
  sessions: Map<string, AgentSessionRow>;
  savedStates: AgentSessionState[];
  traces: DecisionTraceInput[];
  aiCalls: Array<Record<string, unknown>>;
  setAiScript(script: Array<AiTurnResult | Error>): void;
}

function makeHarness(stateOverrides: Partial<AgentSessionState> = {}): Harness {
  const sessions = new Map<string, AgentSessionRow>();
  const savedStates: AgentSessionState[] = [];
  const traces: DecisionTraceInput[] = [];
  const aiCalls: Array<Record<string, unknown>> = [];
  let script: Array<AiTurnResult | Error> = [];

  const agentState: AgentSessionState = {
    ...initialAgentState({
      tutorKey: "nova",
      negotiatedLevel: "STANDARD",
      deliveryLevel: "3",
      lessonRunId: "lesson-run-1",
    }),
    ...stateOverrides,
  };
  sessions.set(SESSION, {
    id: SESSION,
    tenantId: TENANT,
    learnerId: LEARNER,
    tutorSku: "ADDON_TUTOR_MATH",
    sessionType: "agent_lesson",
    functioningLevel: agentState.negotiatedLevel,
    brainContext: {
      grade_band: "3",
      mastery_levels: { "ccss.3.oa.a.1": 0.35 },
      curriculum_focus: { title: "Multiplication as groups" },
    },
    agentState,
    completedAt: null,
  });

  const orchestrator = new AgentOrchestrator({
    store: {
      async loadSession(id) {
        const row = sessions.get(id);
        if (!row) return null;
        // Deep-ish copy so the orchestrator can't mutate the fixture row.
        return { ...row, agentState: row.agentState ? structuredClone(row.agentState) : null };
      },
      async saveAgentState(id, state) {
        savedStates.push(structuredClone(state));
        const row = sessions.get(id);
        if (row) row.agentState = structuredClone(state);
      },
      async insertTrace(trace) {
        traces.push(trace);
      },
    },
    async callAiTurn(payload) {
      aiCalls.push(payload);
      const next = script.shift();
      if (!next) throw new Error("ai script exhausted");
      if (next instanceof Error) throw next;
      return next;
    },
    async fetchBrainContext() {
      return { grade_band: "3", mastery_levels: { "ccss.3.oa.a.1": 0.35 } };
    },
    async getCurriculumFocus() {
      return { title: "Multiplication as groups", topics: ["equal groups"] };
    },
  });

  return {
    orchestrator,
    sessions,
    savedStates,
    traces,
    aiCalls,
    setAiScript(s) {
      script = [...s];
    },
  };
}

async function turn(h: Harness, observation = makeObservation()) {
  return h.orchestrator.runTurn({
    sessionId: SESSION,
    learnerId: LEARNER,
    observation,
    getDefinition: getTutorDefinition,
  });
}

describe("AgentOrchestrator.runTurn", () => {
  let h: Harness;
  beforeEach(() => {
    h = makeHarness();
  });

  it("returns an accepted action, persists state + trace, charges the envelope", async () => {
    h.setAiScript([
      {
        kind: "action",
        action: { kind: "insert_scaffold", scaffold: "Try counting up from 3." },
        rationale: "two misses on the same skill",
        usage: { prompt_tokens: 400, completion_tokens: 30, model: "stub" },
      },
    ]);
    const result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.kind, "action");
    assert.equal(result.action?.kind, "insert_scaffold");
    assert.equal(result.effect, "insert_beat");
    assert.equal(result.seq, 1);
    assert.equal(result.rung, "full");

    assert.equal(h.savedStates.length, 1);
    assert.equal(h.savedStates[0].seq, 1);
    assert.equal(h.savedStates[0].envelope.used, 430);

    assert.equal(h.traces.length, 1);
    assert.equal(h.traces[0].decision, "accepted:insert_scaffold");
    assert.equal(h.traces[0].tutorKey, "nova");
    assert.equal(h.traces[0].observationDigest, observationDigest(makeObservation()));
    assert.deepEqual(h.traces[0].action, {
      kind: "insert_scaffold",
      scaffold: "Try counting up from 3.",
    });
  });

  it("restricts allowed_actions to the tutor's policy and offers only executable tools", async () => {
    h.setAiScript([
      { kind: "action", action: { kind: "advance" }, usage: {} },
    ]);
    await turn(h);
    assert.equal(h.aiCalls.length, 1);
    const call = h.aiCalls[0];
    // Nova STANDARD = full vocabulary (8 actions).
    assert.deepEqual(
      [...(call.allowed_actions as string[])].sort(),
      [
        "advance",
        "end_early",
        "insert_scaffold",
        "offer_break",
        "present_surface",
        "remediate",
        "say",
        "switch_modality",
      ],
    );
    // Nova declares read_math_work too, but its adapter lands in S10 —
    // the model must never be offered a tool we cannot execute.
    const toolNames = (call.allowed_tools as Array<{ name: string }>).map((t) => t.name).sort();
    assert.deepEqual(toolNames, [
      "get_curriculum_context",
      "get_learner_snapshot",
      "get_skill_position",
    ]);
    assert.equal(call.model_tier, "decision");
    assert.equal(call.functioning_level, "STANDARD");
  });

  it("executes a tool roundtrip and feeds results back to the model", async () => {
    h.setAiScript([
      {
        kind: "tool_request",
        tool_calls: [{ name: "get_skill_position", arguments: {} }],
        usage: { prompt_tokens: 300, completion_tokens: 15 },
      },
      {
        kind: "action",
        action: { kind: "remediate", focus: "making equal groups", approach: "worked_example" },
        usage: { prompt_tokens: 500, completion_tokens: 40 },
      },
    ]);
    const result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.kind, "action");
    assert.equal(result.action?.kind, "remediate");
    assert.equal(result.effect, "insert_beat");

    assert.equal(h.aiCalls.length, 2);
    assert.equal(h.aiCalls[0].roundtrip, 0);
    assert.equal(h.aiCalls[1].roundtrip, 1);
    const fedBack = h.aiCalls[1].tool_results as Array<{
      name: string;
      result: { skill_id: string; mastery: number | null; recent_miss_streak: number };
    }>;
    assert.equal(fedBack.length, 1);
    assert.equal(fedBack[0].name, "get_skill_position");
    assert.equal(fedBack[0].result.skill_id, "ccss.3.oa.a.1");
    assert.equal(fedBack[0].result.mastery, 0.35);
    assert.equal(fedBack[0].result.recent_miss_streak, 2);
    // Envelope charged for BOTH calls.
    assert.equal(h.savedStates[0].envelope.used, 300 + 15 + 500 + 40);
  });

  it("rejects an action the SessionMachine guard refuses (say below the floor)", async () => {
    h = makeHarness({ negotiatedLevel: "LOW_VERBAL" });
    // Simulate a misbehaving model that proposes free-text say anyway.
    h.setAiScript([
      { kind: "action", action: { kind: "say", text: "improvised prose" }, usage: {} },
    ]);
    const result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.kind, "deterministic");
    assert.equal(result.reason, "guard_say_below_floor");
    assert.equal(result.action, null);
    assert.equal(h.traces[0].decision, "rejected:say_below_floor");
    // And the policy sent to the model already excluded say.
    assert.ok(!(h.aiCalls[0].allowed_actions as string[]).includes("say"));
  });

  it("treats an ai-svc fallback as a failure and drops the rung after two in a row", async () => {
    const drops: string[] = [];
    // Two fallback turns → consecutive-failure drop full → checkpoint.
    h.setAiScript([{ kind: "fallback", fallback_reason: "validation_retries_exhausted" }]);
    let result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.kind, "deterministic");
    assert.equal(result.reason, "agent_fallback");
    assert.equal(result.rung, "full");

    h.setAiScript([{ kind: "fallback", fallback_reason: "gateway_error:Timeout" }]);
    result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.rung, "checkpoint");

    // On checkpoint, a guided (non-check) beat skips the model entirely.
    h.setAiScript([]);
    result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.kind, "deterministic");
    assert.equal(result.reason, "ladder_checkpoint");
    assert.equal(h.traces[2].decision, "skipped:rung_checkpoint");
    assert.equal(h.aiCalls.length, 2, "no model call on a skipped rung");
    void drops;
  });

  it("still consults on check beats at the checkpoint rung", async () => {
    h = makeHarness({
      ladder: { rung: "checkpoint", latencies: [], consecutiveFailures: 0 },
    });
    h.setAiScript([{ kind: "action", action: { kind: "advance" }, usage: {} }]);
    const result = await turn(h, makeObservation({ beatKind: "check", beatIndex: 6 }));
    assert.ok(!("error" in result));
    assert.equal(result.kind, "action");
    assert.equal(h.aiCalls.length, 1);
  });

  it("goes deterministic on transport errors without throwing", async () => {
    h.setAiScript([new Error("ECONNREFUSED")]);
    const result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.kind, "deterministic");
    assert.equal(result.reason, "ai_unreachable");
    assert.equal(h.traces[0].decision, "fallback:transport");
  });

  it("skips the model entirely once the token envelope is spent", async () => {
    h = makeHarness({ envelope: { limit: 8000, used: 7900 } });
    h.setAiScript([]);
    const result = await turn(h);
    assert.ok(!("error" in result));
    assert.equal(result.kind, "deterministic");
    assert.equal(result.reason, "envelope_exhausted");
    assert.equal(h.aiCalls.length, 0);
    // Envelope exhaustion is a hard drop to deterministic.
    assert.equal(result.rung, "deterministic");
  });

  it("validates session identity: unknown id, wrong learner, closed session", async () => {
    const missing = await h.orchestrator.runTurn({
      sessionId: "99999999-9999-4999-8999-999999999999",
      learnerId: LEARNER,
      observation: makeObservation(),
      getDefinition: getTutorDefinition,
    });
    assert.ok("error" in missing && missing.status === 404);

    const wrongLearner = await h.orchestrator.runTurn({
      sessionId: SESSION,
      learnerId: "44444444-4444-4444-8444-444444444444",
      observation: makeObservation(),
      getDefinition: getTutorDefinition,
    });
    assert.ok("error" in wrongLearner && wrongLearner.status === 403);

    h.sessions.get(SESSION)!.completedAt = new Date();
    const closed = await turn(h);
    assert.ok("error" in closed && closed.status === 409);
  });
});

describe("buildMachineMirror", () => {
  it("derives core phase on interaction beats and accepts structural moves", () => {
    const machine = buildMachineMirror(makeObservation(), "STANDARD");
    assert.equal(machine.proposeTransition({ kind: "insert_scaffold" }).accepted, true);
    assert.equal(machine.proposeTransition({ kind: "advance" }).accepted, true);
  });

  it("locks instruction during the celebration wind-down", () => {
    const obs = makeObservation({
      beatIndex: 7,
      beatKind: "check",
      beatKinds: [
        "welcome",
        "goal",
        "micro",
        "example",
        "guided",
        "guided",
        "check",
        "celebrate",
      ],
    });
    // Current beat index 7 = celebrate → remediation must be refused.
    const machine = buildMachineMirror(obs, "STANDARD");
    const verdict = machine.proposeTransition({ kind: "remediate" });
    assert.equal(verdict.accepted, false);
    assert.ok(!verdict.accepted && verdict.reason === "celebration_locked");
  });
});

describe("parseObservation", () => {
  it("accepts a well-formed observation and clamps text", () => {
    const parsed = parseObservation({
      ...makeObservation(),
      prompt: "x".repeat(5_000),
    });
    assert.ok(parsed);
    assert.equal(parsed.prompt.length, 2_000);
    assert.equal(parsed.beatKind, "guided");
  });

  it("rejects malformed observations", () => {
    assert.equal(parseObservation(null), null);
    assert.equal(parseObservation({}), null);
    assert.equal(parseObservation({ ...makeObservation(), beatIndex: -1 }), null);
    assert.equal(parseObservation({ ...makeObservation(), beatIndex: 99 }), null);
    assert.equal(parseObservation({ ...makeObservation(), beatKind: "welcome" }), null);
    assert.equal(parseObservation({ ...makeObservation(), isCorrect: "yes" }), null);
    // beatKinds, when present, must cover every beat.
    assert.equal(
      parseObservation({ ...makeObservation(), beatKinds: ["guided"] }),
      null,
    );
  });
});
