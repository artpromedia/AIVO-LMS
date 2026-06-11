/**
 * Wave E (S13) — offline eval runner: every corpus scenario × every
 * onboarded tutor × every supported functioning level, through the REAL
 * AgentOrchestrator (scripted model, faked stores).
 *
 * 14 tutors × ≥3 levels × 5 scenarios ⇒ ~190 replayed sessions. Run as
 * part of the tutor-svc suite; the tutor:behavior gate covers the same
 * pipeline shape in CI green-check form.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TUTOR_REGISTRY } from "../../src/modes/registry.js";
import { getTutorDefinition } from "../../src/modes/registry.js";
import {
  AgentOrchestrator,
  initialAgentState,
  type AgentSessionRow,
  type AgentSessionState,
  type AiTurnResult,
} from "../../src/agent/orchestrator.js";
import { EVAL_SCENARIOS } from "./corpus.js";
import type { TutorFunctioningLevel } from "@aivo/tutor-sdk";

const LEARNER = "00000000-0000-4000-8000-0000000eva1";
const SESSION = "00000000-0000-4000-8000-0000000eva2";
const TENANT = "00000000-0000-4000-8000-0000000eva3";

const EVAL_LEVELS: TutorFunctioningLevel[] = [
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
];

function makeRunner(tutorKey: string, level: TutorFunctioningLevel) {
  const aiCalls: Array<Record<string, unknown>> = [];
  let script: AiTurnResult[] = [];
  let agentState: AgentSessionState = initialAgentState({
    tutorKey,
    negotiatedLevel: level,
    deliveryLevel: "3",
    lessonRunId: "eval-run",
    aiPersonalizationConsent: true,
  });
  const row: AgentSessionRow = {
    id: SESSION,
    tenantId: TENANT,
    learnerId: LEARNER,
    tutorSku: "EVAL",
    sessionType: "agent_lesson",
    functioningLevel: level,
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
      async insertTrace() {},
    },
    callAiTurn: async (payload) => {
      aiCalls.push(payload);
      const next = script.shift();
      if (!next) throw new Error("eval script exhausted");
      return next;
    },
    fetchBrainContext: async () => ({ grade_band: "3" }),
    getCurriculumFocus: async () => null,
  });
  return {
    aiCalls,
    setScript: (s: AiTurnResult[]) => {
      script = [...s];
    },
    run: (observation: Parameters<AgentOrchestrator["runTurn"]>[0]["observation"]) =>
      orchestrator.runTurn({
        sessionId: SESSION,
        learnerId: LEARNER,
        observation,
        getDefinition: getTutorDefinition,
      }),
  };
}

describe("agent-eval corpus — every onboarded tutor", () => {
  let replayed = 0;
  for (const [tutorKey, def] of Object.entries(TUTOR_REGISTRY)) {
    for (const scenario of EVAL_SCENARIOS) {
      const levels = scenario.levels.filter(
        (l) => def.functioningLevels.includes(l) && EVAL_LEVELS.includes(l),
      );
      for (const level of levels) {
        it(`${tutorKey} × ${level} × ${scenario.id}`, async () => {
          replayed += 1;
          const runner = makeRunner(tutorKey, level);
          const allowed = def.actionPolicy[level] ?? [];
          // Scenarios proposing an action OUTSIDE the tutor's level policy
          // simulate a misbehaving model (ai-svc would reject it; the
          // scripted reply bypasses ai-svc so the MACHINE must hold).
          runner.setScript([
            {
              kind: "action",
              action: scenario.proposal,
              usage: { prompt_tokens: 40, completion_tokens: 10 },
            },
          ]);
          const result = await runner.run(scenario.observation(level));
          assert.ok(!("error" in result), `turn errored for ${tutorKey}/${level}`);

          assert.equal(
            result.kind,
            scenario.expect.kind,
            `${scenario.id}: expected ${scenario.expect.kind}, got ${result.kind} (${result.reason})`,
          );
          if (scenario.expect.kind === "action" && scenario.expect.effect) {
            assert.equal(result.effect, scenario.expect.effect);
          }
          if (scenario.expect.kind === "deterministic" && scenario.expect.reason) {
            assert.equal(result.reason, scenario.expect.reason);
          }
          if (scenario.expect.snapshotPreSeeded !== undefined) {
            const seeded =
              (runner.aiCalls[0]?.tool_results as unknown[] | undefined)?.length ?? 0;
            assert.equal(
              seeded > 0,
              scenario.expect.snapshotPreSeeded,
              `${scenario.id}: snapshot pre-seed mismatch`,
            );
          }
          // The action space sent to the model is ALWAYS the tutor's
          // declared per-level policy — every scenario re-proves it.
          assert.deepEqual(
            [...(runner.aiCalls[0].allowed_actions as string[])].sort(),
            [...allowed].sort(),
            `${scenario.id}: action-space drift`,
          );
        });
      }
    }
  }

  it("replays a meaningful corpus (≥3 sessions per tutor × level pair)", () => {
    // 14 tutors × scenarios-per-level ≥ 3 at every supported level.
    assert.ok(replayed >= 14 * 3 * 3, `only ${replayed} sessions replayed`);
  });
});
