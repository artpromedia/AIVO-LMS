/**
 * Wave E (S10) — agent behavioural harness.
 *
 * Replays scripted fixture sessions through the REAL `AgentOrchestrator`
 * (faked model + stores, real guards/ladder/policy plumbing) and scores
 * each onboarded tutor against the five-point agentic definition:
 *
 *   1. observes  — instruments are offered and tool roundtrips execute;
 *   2. decides   — the action space sent to the model is EXACTLY the
 *                  tutor's per-level actionPolicy (closed set);
 *   3. guarded   — an illegal proposal (free-text say below the floor)
 *                  is rejected with a deterministic next, a legal one
 *                  lands with the right machine effect;
 *   4. degrades  — consecutive failures drop the rung, the retired rung
 *                  never consults the model, envelope exhaustion is hard;
 *   5. audited   — every turn left a decision trace with monotonic seq.
 *
 * Emits a JSON report on stdout; `scripts/tutor-behavioral-check.mjs`
 * (pnpm tutor:behavior) consumes it and enforces the onboarding ratchet.
 *
 * Run: pnpm --dir services/tutor-svc exec tsx scripts/agent-behavior-harness.ts
 */
import {
  AgentOrchestrator,
  initialAgentState,
  type AgentSessionRow,
  type AgentSessionState,
  type AiTurnResult,
  type DecisionTraceInput,
  type LessonObservation,
} from "../src/agent/orchestrator.js";
import { getTutorDefinition } from "../src/modes/registry.js";
import type { TutorFunctioningLevel } from "@aivo/tutor-sdk";

/** Tutors certified for the agent pilot. Widening this list is the S13
 *  onboarding lever; the repo-root ratchet refuses silent shrinkage.
 *  S13: the full catalogue — every tutor must hold all five properties. */
const ONBOARDED_TUTORS = [
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
] as const;

const LEVELS: TutorFunctioningLevel[] = ["STANDARD", "SUPPORTED", "LOW_VERBAL"];

const LEARNER = "00000000-0000-4000-8000-00000000beef";
const SESSION = "00000000-0000-4000-8000-00000000cafe";
const TENANT = "00000000-0000-4000-8000-00000000feed";

function observation(overrides: Partial<LessonObservation> = {}): LessonObservation {
  return {
    beatIndex: 4,
    totalBeats: 8,
    beatKind: "guided",
    beatKinds: ["welcome", "goal", "micro", "example", "guided", "guided", "check", "celebrate"],
    prompt: "Practice item",
    learnerResponse: "answer",
    isCorrect: false,
    recentMissStreak: 0,
    secondsOnBeat: 20,
    ...overrides,
  };
}

interface Harness {
  orchestrator: AgentOrchestrator;
  aiCalls: Array<Record<string, unknown>>;
  traces: DecisionTraceInput[];
  domainCalls: string[];
  setScript(script: Array<AiTurnResult | Error>): void;
  state(): AgentSessionState;
}

function makeHarness(tutorKey: string, level: TutorFunctioningLevel): Harness {
  const aiCalls: Array<Record<string, unknown>> = [];
  const traces: DecisionTraceInput[] = [];
  const domainCalls: string[] = [];
  let script: Array<AiTurnResult | Error> = [];
  let agentState: AgentSessionState = initialAgentState({
    tutorKey,
    negotiatedLevel: level,
    deliveryLevel: "3",
    lessonRunId: "behavior-run",
  });
  const row: AgentSessionRow = {
    id: SESSION,
    tenantId: TENANT,
    learnerId: LEARNER,
    tutorSku: "BEHAVIOR",
    sessionType: "agent_lesson",
    functioningLevel: level,
    brainContext: { grade_band: "3", mastery_levels: {} },
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
    async callAiTurn(payload) {
      aiCalls.push(payload);
      const next = script.shift();
      if (!next) throw new Error("script exhausted");
      if (next instanceof Error) throw next;
      return next;
    },
    fetchBrainContext: async () => ({ grade_band: "3" }),
    getCurriculumFocus: async () => null,
    async runDomainTool(name) {
      domainCalls.push(name);
      return { ok: true, note: "fixture domain result" };
    },
  });
  return {
    orchestrator,
    aiCalls,
    traces,
    domainCalls,
    setScript(s) {
      script = [...s];
    },
    state: () => agentState,
  };
}

async function turn(h: Harness, obs: LessonObservation) {
  const result = await h.orchestrator.runTurn({
    sessionId: SESSION,
    learnerId: LEARNER,
    observation: obs,
    getDefinition: getTutorDefinition,
  });
  if ("error" in result) throw new Error(`turn errored: ${result.error}`);
  return result;
}

interface TutorReport {
  tutorKey: string;
  checks: {
    observes: boolean;
    decides_closed_set: boolean;
    guarded_transitions: boolean;
    degrades_safely: boolean;
    audited: boolean;
  };
  levels: string[];
  turns: number;
  notes: string[];
}

async function certifyTutor(tutorKey: string): Promise<TutorReport> {
  const def = getTutorDefinition(tutorKey);
  if (!def) throw new Error(`unknown tutor ${tutorKey}`);
  const notes: string[] = [];
  let observes = true;
  let decidesClosed = true;
  let guarded = true;
  let degrades = true;
  let audited = true;
  let totalTurns = 0;

  for (const level of LEVELS.filter((l) => def.functioningLevels.includes(l))) {
    const h = makeHarness(tutorKey, level);
    const allowed = def.actionPolicy[level] ?? [];

    // ── 1+2: observe + closed decision set ────────────────────────────
    const domainTool = def.toolset.find((t) =>
      ["read_math_work", "evaluate_science_answer", "score_pronunciation", "break_down_task"].includes(t),
    );
    h.setScript([
      domainTool
        ? {
            kind: "tool_request",
            tool_calls: [{ name: domainTool, arguments: {} }],
            usage: { prompt_tokens: 50, completion_tokens: 5 },
          }
        : {
            kind: "tool_request",
            tool_calls: [{ name: "get_skill_position", arguments: {} }],
            usage: { prompt_tokens: 50, completion_tokens: 5 },
          },
      {
        kind: "action",
        action: { kind: "advance" },
        usage: { prompt_tokens: 50, completion_tokens: 5 },
      },
    ]);
    const r1 = await turn(h, observation());
    totalTurns += 1;
    if (r1.kind !== "action") {
      observes = false;
      notes.push(`${tutorKey}/${level}: tool roundtrip did not complete (${r1.reason})`);
    }
    if (domainTool && !h.domainCalls.includes(domainTool)) {
      observes = false;
      notes.push(`${tutorKey}/${level}: domain tool ${domainTool} not executed`);
    }
    const sentActions = [...(h.aiCalls[0].allowed_actions as string[])].sort();
    if (JSON.stringify(sentActions) !== JSON.stringify([...allowed].sort())) {
      decidesClosed = false;
      notes.push(
        `${tutorKey}/${level}: action space drift — policy ${JSON.stringify(
          [...allowed].sort(),
        )} vs sent ${JSON.stringify(sentActions)}`,
      );
    }

    // ── 3: guarded transitions ─────────────────────────────────────────
    // A misbehaving model proposes free-text say; below the floor the
    // machine MUST reject it; at STANDARD it must be accepted (legal).
    h.setScript([
      {
        kind: "action",
        action: { kind: "say", text: "improvised text" },
        usage: { prompt_tokens: 30, completion_tokens: 5 },
      },
    ]);
    const r2 = await turn(h, observation());
    totalTurns += 1;
    const sayForbidden = ["LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"].includes(level);
    if (sayForbidden && (r2.kind !== "deterministic" || r2.reason !== "guard_say_below_floor")) {
      guarded = false;
      notes.push(`${tutorKey}/${level}: say below the floor was not rejected`);
    }
    if (!sayForbidden && r2.kind !== "action") {
      guarded = false;
      notes.push(`${tutorKey}/${level}: legal say was not accepted (${r2.reason})`);
    }

    // ── 4: degradation ladder ─────────────────────────────────────────
    h.setScript([{ kind: "fallback", fallback_reason: "f1" }]);
    await turn(h, observation());
    h.setScript([{ kind: "fallback", fallback_reason: "f2" }]);
    const r3 = await turn(h, observation());
    totalTurns += 2;
    if (r3.rung !== "checkpoint") {
      degrades = false;
      notes.push(`${tutorKey}/${level}: two failures did not drop the rung (${r3.rung})`);
    }
    // Retired rung: guided beat must skip the model entirely.
    h.setScript([]);
    const callsBefore = h.aiCalls.length;
    const r4 = await turn(h, observation());
    totalTurns += 1;
    if (r4.kind !== "deterministic" || h.aiCalls.length !== callsBefore) {
      degrades = false;
      notes.push(`${tutorKey}/${level}: checkpoint rung still consulted on a guided beat`);
    }

    // ── 5: audit trail ────────────────────────────────────────────────
    const seqs = h.traces.map((t) => t.seq);
    const monotonic = seqs.every((s, i) => (i === 0 ? s === 1 : s === seqs[i - 1] + 1));
    if (h.traces.length !== 5 || !monotonic) {
      audited = false;
      notes.push(
        `${tutorKey}/${level}: expected 5 ordered traces, got ${h.traces.length} (${seqs.join(",")})`,
      );
    }
    if (!h.traces.every((t) => t.observationDigest.length === 16 && t.decision.length > 0)) {
      audited = false;
      notes.push(`${tutorKey}/${level}: trace rows missing digest/decision`);
    }
  }

  return {
    tutorKey,
    checks: {
      observes,
      decides_closed_set: decidesClosed,
      guarded_transitions: guarded,
      degrades_safely: degrades,
      audited,
    },
    levels: LEVELS.filter((l) => def.functioningLevels.includes(l)),
    turns: totalTurns,
    notes,
  };
}

async function main() {
  const reports: TutorReport[] = [];
  for (const tutorKey of ONBOARDED_TUTORS) {
    reports.push(await certifyTutor(tutorKey));
  }
  // Single sentinel line: the repo-root wrapper greps it out from any
  // interleaved structured-log output (ladder-drop warns are expected —
  // the degradation check intentionally trips them).
  process.stdout.write(
    `BEHAVIOR_REPORT_JSON:${JSON.stringify({ onboarded: [...ONBOARDED_TUTORS], reports })}\n`,
  );
  const failed = reports.filter((r) => Object.values(r.checks).some((c) => !c));
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("agent-behavior-harness crashed:", err);
  process.exit(2);
});
