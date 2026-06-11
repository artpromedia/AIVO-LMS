/**
 * Wave E (S12) — episodic memory: the `remember` tool + retrieval gates.
 *
 * The privacy contract under test:
 *   - kinds restricted to BOTH the closed vocabulary and the tutor's
 *     declared memoryPolicy.kinds;
 *   - content bounded; every row expires 180 days out;
 *   - the orchestrator offers/executes memory ONLY with policy + executor
 *     + ai_personalization consent aligned, and caps writes at 2/session;
 *   - retrieval renders a compact, capped context block.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  executeRememberTool,
  memoryExpiry,
  renderMemoryContext,
  MEMORY_TTL_DAYS,
  MEMORY_TOP_K,
} from "../src/agent/memory.js";
import {
  AgentOrchestrator,
  initialAgentState,
  type AgentSessionRow,
  type AgentSessionState,
  type AiTurnResult,
  type DecisionTraceInput,
} from "../src/agent/orchestrator.js";
import { getTutorDefinition } from "../src/modes/registry.js";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const TENANT = "33333333-3333-4333-8333-333333333333";

const CTX = {
  tenantId: TENANT,
  sessionId: SESSION,
  learnerId: LEARNER,
  tutorKey: "nova",
  allowedKinds: ["strategy_preference", "interest", "trigger", "win"] as readonly string[],
};

describe("executeRememberTool", () => {
  it("writes a bounded row with a 180-day expiry", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const before = Date.now();
    const result = await executeRememberTool(
      { kind: "strategy_preference", content: "Worked examples before practice help a lot." },
      CTX,
      {
        async insertMemory(input) {
          inserts.push(input as unknown as Record<string, unknown>);
        },
      },
    );
    assert.equal(result.remembered, true);
    assert.equal(inserts.length, 1);
    const expires = (inserts[0].expiresAt as Date).getTime();
    const expected = before + MEMORY_TTL_DAYS * 24 * 60 * 60 * 1000;
    assert.ok(Math.abs(expires - expected) < 60_000, "expiry ≈ 180 days out");
  });

  it("rejects kinds outside the vocabulary or the tutor's policy", async () => {
    const noWrite = { insertMemory: async () => assert.fail("must not write") };
    const badVocab = await executeRememberTool(
      { kind: "diagnosis", content: "long enough content" },
      CTX,
      noWrite,
    );
    assert.ok(typeof badVocab.error === "string");
    const badPolicy = await executeRememberTool(
      { kind: "win", content: "long enough content" },
      { ...CTX, allowedKinds: ["interest"] },
      noWrite,
    );
    assert.ok(String(badPolicy.error).includes("memory policy"));
  });

  it("bounds content length", async () => {
    const noWrite = { insertMemory: async () => assert.fail("must not write") };
    assert.ok(
      typeof (await executeRememberTool({ kind: "win", content: "ab" }, CTX, noWrite)).error ===
        "string",
    );
    assert.ok(
      typeof (
        await executeRememberTool({ kind: "win", content: "x".repeat(301) }, CTX, noWrite)
      ).error === "string",
    );
  });

  it("memoryExpiry is deterministic from the clock", () => {
    const now = new Date("2026-06-11T00:00:00.000Z");
    assert.equal(
      memoryExpiry(now).toISOString(),
      new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    );
  });
});

describe("renderMemoryContext", () => {
  it("caps rows at top-k and truncates long content", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      id: `m${i}`,
      kind: "interest",
      content: `${"y".repeat(400)}-${i}`,
      createdAt: "",
      expiresAt: "",
    }));
    const block = renderMemoryContext(rows);
    assert.equal(block.split("\n").length, 1 + MEMORY_TOP_K);
    assert.ok(block.includes("parent-visible"));
    assert.ok(!block.includes("y".repeat(301)), "content truncated");
    assert.equal(renderMemoryContext([]), "");
  });
});

// ── orchestrator gates ───────────────────────────────────────────────────────

function makeMemoryHarness(opts: {
  consent: boolean;
  memories: number;
  retrieved?: Array<{ kind: string; content: string }>;
  withExecutor?: boolean;
}) {
  const aiCalls: Array<Record<string, unknown>> = [];
  const traces: DecisionTraceInput[] = [];
  const memoryCalls: Array<Record<string, unknown>> = [];
  let script: Array<AiTurnResult | Error> = [];
  let agentState: AgentSessionState = {
    ...initialAgentState({
      tutorKey: "nova",
      negotiatedLevel: "STANDARD",
      deliveryLevel: "3",
      lessonRunId: "run-1",
      aiPersonalizationConsent: opts.consent,
    }),
    writes: { evidence: 0, proposals: 0, memories: opts.memories },
  };
  const row: AgentSessionRow = {
    id: SESSION,
    tenantId: TENANT,
    learnerId: LEARNER,
    tutorSku: "ADDON_TUTOR_MATH",
    sessionType: "agent_lesson",
    functioningLevel: "STANDARD",
    brainContext: { grade_band: "3" },
    agentState,
    completedAt: null,
  };
  const orchestrator = new AgentOrchestrator({
    store: {
      async loadSession() {
        return { ...row, agentState: structuredClone(agentState) };
      },
      async saveAgentState(_id, state) {
        agentState = structuredClone(state);
      },
      async insertTrace(trace) {
        traces.push(trace);
      },
    },
    callAiTurn: async (payload) => {
      aiCalls.push(payload);
      const next = script.shift();
      if (!next) throw new Error("script exhausted");
      if (next instanceof Error) throw next;
      return next;
    },
    fetchBrainContext: async () => ({}),
    getCurriculumFocus: async () => null,
    ...(opts.withExecutor === false
      ? {}
      : {
          async runMemoryTool(args: Record<string, unknown>) {
            memoryCalls.push(args);
            return { remembered: true, kind: String(args.kind) };
          },
          retrieveMemories: async () => opts.retrieved ?? [],
        }),
  });
  return {
    orchestrator,
    aiCalls,
    memoryCalls,
    setScript: (s: Array<AiTurnResult | Error>) => {
      script = [...s];
    },
    state: () => agentState,
  };
}

const OBSERVATION = {
  beatIndex: 4,
  totalBeats: 8,
  beatKind: "guided" as const,
  beatKinds: [
    "welcome",
    "goal",
    "micro",
    "example",
    "guided",
    "guided",
    "check",
    "celebrate",
  ] as Array<
    "welcome" | "goal" | "micro" | "example" | "guided" | "check" | "celebrate" | "next"
  >,
  prompt: "What is 3 x 4?",
  learnerResponse: "12",
  isCorrect: true,
  recentMissStreak: 0,
};

async function run(h: ReturnType<typeof makeMemoryHarness>) {
  return h.orchestrator.runTurn({
    sessionId: SESSION,
    learnerId: LEARNER,
    observation: OBSERVATION,
    getDefinition: getTutorDefinition,
  });
}

describe("orchestrator memory gates", () => {
  it("offers remember + injects retrieved memories only with consent", async () => {
    const h = makeMemoryHarness({
      consent: true,
      memories: 0,
      retrieved: [{ kind: "interest", content: "loves trains" }],
    });
    h.setScript([{ kind: "action", action: { kind: "advance" }, usage: {} }]);
    await run(h);
    const offered = (h.aiCalls[0].allowed_tools as Array<{ name: string }>).map((t) => t.name);
    assert.ok(offered.includes("remember"));
    assert.ok(String(h.aiCalls[0].persona_context).includes("loves trains"));
  });

  it("withholds remember and retrieval without consent", async () => {
    const h = makeMemoryHarness({
      consent: false,
      memories: 0,
      retrieved: [{ kind: "interest", content: "loves trains" }],
    });
    h.setScript([{ kind: "action", action: { kind: "advance" }, usage: {} }]);
    await run(h);
    const offered = (h.aiCalls[0].allowed_tools as Array<{ name: string }>).map((t) => t.name);
    assert.ok(!offered.includes("remember"));
    assert.ok(!String(h.aiCalls[0].persona_context).includes("loves trains"));
  });

  it("executes remember through the executor and persists the count", async () => {
    const h = makeMemoryHarness({ consent: true, memories: 0 });
    h.setScript([
      {
        kind: "tool_request",
        tool_calls: [
          { name: "remember", arguments: { kind: "win", content: "first independent regroup" } },
        ],
        usage: {},
      },
      { kind: "action", action: { kind: "advance" }, usage: {} },
    ]);
    const result = await run(h);
    assert.ok(!("error" in result));
    assert.equal(h.memoryCalls.length, 1);
    assert.equal(h.state().writes.memories, 1);
  });

  it("caps memory writes at 2 per session", async () => {
    const h = makeMemoryHarness({ consent: true, memories: 2 });
    h.setScript([
      {
        kind: "tool_request",
        tool_calls: [{ name: "remember", arguments: { kind: "win", content: "third note" } }],
        usage: {},
      },
      { kind: "action", action: { kind: "advance" }, usage: {} },
    ]);
    await run(h);
    assert.equal(h.memoryCalls.length, 0, "executor never reached past the cap");
    const fedBack = h.aiCalls[1].tool_results as Array<{ result: { error?: string } }>;
    assert.ok(String(fedBack[0].result.error).includes("memory cap reached"));
    assert.equal(h.state().writes.memories, 2);
  });
});
