/**
 * Wave E (S9) — the Tutor Agent Orchestrator.
 *
 * tutor-svc owns the agent session: it holds state between stateless
 * turns (token envelope, degradation-ladder rung, turn seq — persisted in
 * `tutor_sessions.agent_state`), executes the read tools the model may
 * request, and validates every proposed action against the
 * `SessionMachine.proposeTransition` guard before anything reaches a
 * learner. ai-svc (`/api/ai/tutor-agent/turn`) owns only the model turn.
 *
 * Layered guarantees (each independent of the others):
 *   1. ai-svc validates the reply protocol + quality-gates learner text.
 *   2. This orchestrator restricts `allowed_actions` to the tutor's
 *      per-functioning-level `actionPolicy` and `allowed_tools` to the
 *      executable subset of the tutor's declared `toolset`.
 *   3. The SessionMachine mirror rejects structurally illegal moves
 *      (acting on a complete session, re-opening instruction during the
 *      celebration wind-down, free-text `say` below the floor).
 *   4. The AgentLadder drops a struggling session toward deterministic
 *      mode — agentic is never load-bearing.
 *
 * Every turn — accepted, rejected, fallback, or rung-skipped — appends a
 * `tutor_decision_traces` row so the session's reasoning replays in order.
 */
import { SessionMachine } from "@aivo/stage-runtime";
import type { Beat, FunctioningLevel } from "@aivo/stage-ui";
import {
  AgentLadder,
  type AgentRung,
  type LadderSnapshot,
  type RungDrop,
} from "@aivo/tutor-runtime";
import type {
  AgentActionKind,
  AgentToolId,
  TutorDefinition,
  TutorFunctioningLevel,
} from "@aivo/tutor-sdk";
import { createLogger, recordAgentRungDrop, recordAgentTurn } from "@aivo/observability";
import { createHash } from "node:crypto";
import { DOMAIN_TOOL_SCHEMAS } from "./tools.js";
import { WRITE_TOOL_SCHEMAS } from "./write-tools.js";
import { MEMORY_TOP_K, REMEMBER_TOOL_SCHEMA, renderMemoryContext } from "./memory.js";
import { renderSelPhraseBankBlock } from "./sel-phrase-bank.js";

const logger = createLogger("tutor-svc.agent");

// ── Wire contracts ──────────────────────────────────────────────────────────

/** Beat kinds the web lesson player reports (see lesson-player.tsx). */
export type LessonBeatKind =
  | "welcome"
  | "goal"
  | "story"
  | "micro"
  | "example"
  | "guided"
  | "check"
  | "celebrate"
  | "progress"
  | "next";

/** One observation from the lesson player: the learner just answered. */
export interface LessonObservation {
  beatIndex: number;
  totalBeats: number;
  beatKind: "guided" | "check";
  /** Full beat-kind sequence so the machine mirror is structurally honest. */
  beatKinds: LessonBeatKind[];
  prompt: string;
  learnerResponse: string;
  isCorrect: boolean;
  expectedAnswer?: string;
  attemptsOnBeat?: number;
  hintsUsed?: number;
  scaffoldsUsed?: number;
  /** Consecutive incorrect answers up to and including this one. */
  recentMissStreak?: number;
  secondsOnBeat?: number;
  skillId?: string;
  /** Wave E (S10): the learner showed frustration this beat (e.g. opened
   *  the break screen mid-item). Triggers a fresh snapshot re-fetch. */
  frustrationEvent?: boolean;
}

/** Persisted between turns in `tutor_sessions.agent_state`. */
export interface AgentSessionState {
  seq: number;
  envelope: { limit: number; used: number };
  ladder: LadderSnapshot;
  tutorKey: string;
  negotiatedLevel: TutorFunctioningLevel;
  deliveryLevel: string;
  lessonRunId: string | null;
  /** Wave E (S11): per-session write-tool usage (caps enforced here). */
  writes: { evidence: number; proposals: number; memories: number };
  /** Wave E (S12): consent facts recorded at open (BFF-guarded). Memory
   *  reads/writes are refused without ai_personalization. */
  consent: { aiPersonalization: boolean };
}

/** The validated agent action, as returned by ai-svc (snake_case wire). */
export type AgentWireAction = { kind: AgentActionKind } & Record<string, unknown>;

/** ai-svc `/api/ai/tutor-agent/turn` response (TurnResult). */
export interface AiTurnResult {
  kind: "action" | "tool_request" | "fallback";
  action?: AgentWireAction | null;
  tool_calls?: Array<{ name: string; arguments: Record<string, unknown> }> | null;
  rationale?: string;
  fallback_reason?: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number; model?: string };
}

/** What the orchestrator returns to the BFF for one turn. */
export interface TurnDecision {
  kind: "action" | "deterministic";
  /** Present only when kind === "action". */
  action: AgentWireAction | null;
  /** SessionMachine effect for an accepted action. */
  effect: "advance" | "insert_beat" | "non_structural" | "end" | null;
  /** Why the turn was deterministic (rung skip / fallback / guard reject). */
  reason: string | null;
  rung: AgentRung;
  seq: number;
  latencyMs: number;
}

// ── Dependencies (injectable so the loop is unit-testable) ──────────────────

export interface AgentSessionRow {
  id: string;
  tenantId: string;
  learnerId: string;
  tutorSku: string;
  sessionType: string | null;
  functioningLevel: string | null;
  brainContext: Record<string, unknown> | null;
  agentState: AgentSessionState | null;
  completedAt: Date | null;
}

export interface DecisionTraceInput {
  tenantId: string;
  sessionId: string;
  learnerId: string;
  tutorKey: string;
  seq: number;
  observationDigest: string;
  action: AgentWireAction | null;
  rationale: string;
  decision: string;
  rung: AgentRung;
  latencyMs: number;
}

export interface AgentStore {
  loadSession(sessionId: string): Promise<AgentSessionRow | null>;
  saveAgentState(sessionId: string, state: AgentSessionState): Promise<void>;
  insertTrace(trace: DecisionTraceInput): Promise<void>;
}

export interface OrchestratorDeps {
  store: AgentStore;
  /** POST to ai-svc /api/ai/tutor-agent/turn with X-Internal-Auth. */
  callAiTurn(payload: Record<string, unknown>): Promise<AiTurnResult>;
  /** Read tools. Failures resolve to an error payload, never throw a turn. */
  fetchBrainContext(learnerId: string): Promise<Record<string, unknown>>;
  getCurriculumFocus(learnerId: string, subject: string): Promise<unknown | null>;
  /**
   * Wave E (S10): domain tool executor (read_math_work, score_pronunciation,
   * evaluate_science_answer, break_down_task → their backing services).
   * Failures resolve to `{ error }`. When absent, domain tools are not
   * offered to the model.
   */
  runDomainTool?(
    name: string,
    args: Record<string, unknown>,
    ctx: { learnerId: string; observation: LessonObservation },
  ): Promise<Record<string, unknown>>;
  /**
   * Wave E (S11): write-tool executor (file_evidence,
   * propose_recommendation → agent/write-tools.ts). When absent, write
   * tools are never offered. Per-session caps are enforced HERE (via
   * agent_state.writes), not in the executor.
   */
  runWriteTool?(
    name: string,
    args: Record<string, unknown>,
    ctx: {
      tenantId: string;
      sessionId: string;
      learnerId: string;
      tutorKey: string;
      observation: LessonObservation;
    },
  ): Promise<Record<string, unknown>>;
  /** Wave E (S12): the `remember` executor. `allowedKinds` carries the
   *  tutor's declared memoryPolicy.kinds for the kind gate. */
  runMemoryTool?(
    args: Record<string, unknown>,
    ctx: {
      tenantId: string;
      sessionId: string;
      learnerId: string;
      tutorKey: string;
      allowedKinds: readonly string[];
    },
  ): Promise<Record<string, unknown>>;
  /** Wave E (S12): top-k unexpired memory retrieval for the turn context. */
  retrieveMemories?(input: {
    tenantId: string;
    learnerId: string;
    tutorKey: string;
    k: number;
  }): Promise<Array<{ kind: string; content: string }>>;
  onRungDrop?(sessionId: string, drop: RungDrop): void;
  now?(): number;
}

// ── Tunables ─────────────────────────────────────────────────────────────────

/** Per-session token envelope (matches the ai-svc default). */
export const SESSION_TOKEN_ENVELOPE = 8_000;
/** Tool roundtrips per turn — mirrors ai-svc MAX_TOOL_ROUNDTRIPS. */
export const MAX_TOOL_ROUNDTRIPS = 3;
/** ai-svc must answer within the gateway floor; the ladder handles slowness. */
export const ENVELOPE_FLOOR_TOKENS = 200;

/** The always-executable read belt (served in-process by this module). */
export const READ_TOOLS: ReadonlySet<AgentToolId> = new Set([
  "get_learner_snapshot",
  "get_skill_position",
  "get_curriculum_context",
] as AgentToolId[]);

/**
 * Domain tools (Wave E S10) — executable only when the orchestrator was
 * wired with a `runDomainTool` dep (the route wires the real adapters in
 * `agent/tools.ts`; tests inject fakes). A tutor may DECLARE these in its
 * toolset, but the model is offered only what this process can execute.
 */
export const DOMAIN_TOOLS: ReadonlySet<AgentToolId> = new Set([
  "read_math_work",
  "evaluate_science_answer",
  "score_pronunciation",
  "break_down_task",
] as AgentToolId[]);

/** Write tools (Wave E S11) — executable only with a runWriteTool dep. */
export const WRITE_TOOLS: ReadonlySet<AgentToolId> = new Set([
  "file_evidence",
  "propose_recommendation",
] as AgentToolId[]);

/** Per-session write caps (bounded agency — see agent/write-tools.ts). */
export const WRITE_CAPS = { evidence: 5, proposals: 1, memories: 2 } as const;

/** The memory tool id (Wave E S12) — offered only when the tutor's
 *  memoryPolicy allows it, a memory executor is wired, AND the session
 *  carries ai_personalization consent. */
export const MEMORY_TOOL: AgentToolId = "remember" as AgentToolId;

const TOOL_SCHEMAS: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  get_learner_snapshot: {
    description:
      "Current learner profile: functioning level, grade band, mastery levels, preferred modality, accommodations.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  get_skill_position: {
    description:
      "Where the learner stands on the skill behind the current activity (mastery, streaks, attempts).",
    parameters: {
      type: "object",
      properties: { skill_id: { type: "string" } },
      additionalProperties: false,
    },
  },
  get_curriculum_context: {
    description:
      "The learner's active school-syllabus focus for this subject (topics, standards, keywords), when one exists.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};

/**
 * Snapshot re-fetch triggers (S10): when the live session contradicts the
 * cached learner picture, refresh it BEFORE the model decides — pre-seeded
 * as a get_learner_snapshot tool result so no roundtrip is spent.
 */
export function shouldRefetchSnapshot(
  observation: LessonObservation,
  brain: Record<string, unknown>,
): boolean {
  if (observation.frustrationEvent) return true;
  if ((observation.recentMissStreak ?? 0) >= 2) return true;
  const processingMs = Number(
    (brain as { processing_speed_ms?: unknown }).processing_speed_ms ??
      (brain as { functioning_level_profile?: { processing_speed_ms?: unknown } })
        .functioning_level_profile?.processing_speed_ms,
  );
  if (
    Number.isFinite(processingMs) &&
    processingMs > 0 &&
    (observation.secondsOnBeat ?? 0) * 1000 > 2 * processingMs
  ) {
    return true;
  }
  return false;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function observationDigest(observation: LessonObservation): string {
  return createHash("sha256")
    .update(JSON.stringify(observation, Object.keys(observation).sort()))
    .digest("hex")
    .slice(0, 16);
}

export function initialAgentState(input: {
  tutorKey: string;
  negotiatedLevel: TutorFunctioningLevel;
  deliveryLevel: string;
  lessonRunId: string | null;
  /** S12: recorded at open; the BFF only opens behind the consent guard. */
  aiPersonalizationConsent?: boolean;
}): AgentSessionState {
  return {
    seq: 0,
    envelope: { limit: SESSION_TOKEN_ENVELOPE, used: 0 },
    ladder: { rung: "full", latencies: [], consecutiveFailures: 0 },
    tutorKey: input.tutorKey,
    negotiatedLevel: input.negotiatedLevel,
    deliveryLevel: input.deliveryLevel,
    lessonRunId: input.lessonRunId,
    writes: { evidence: 0, proposals: 0, memories: 0 },
    consent: { aiPersonalization: input.aiPersonalizationConsent ?? false },
  };
}

function parseAgentState(raw: unknown, fallbackTutorKey: string): AgentSessionState {
  const base = initialAgentState({
    tutorKey: fallbackTutorKey,
    negotiatedLevel: "STANDARD",
    deliveryLevel: "3",
    lessonRunId: null,
  });
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<AgentSessionState>;
  return {
    seq: typeof s.seq === "number" && s.seq >= 0 ? s.seq : base.seq,
    envelope:
      s.envelope && typeof s.envelope.limit === "number" && typeof s.envelope.used === "number"
        ? { limit: s.envelope.limit, used: Math.max(0, s.envelope.used) }
        : base.envelope,
    ladder: (s.ladder as LadderSnapshot) ?? base.ladder,
    tutorKey: typeof s.tutorKey === "string" && s.tutorKey ? s.tutorKey : base.tutorKey,
    negotiatedLevel: (s.negotiatedLevel as TutorFunctioningLevel) ?? base.negotiatedLevel,
    deliveryLevel: typeof s.deliveryLevel === "string" ? s.deliveryLevel : base.deliveryLevel,
    lessonRunId: typeof s.lessonRunId === "string" ? s.lessonRunId : null,
    writes:
      s.writes &&
      typeof s.writes.evidence === "number" &&
      typeof s.writes.proposals === "number"
        ? {
            evidence: Math.max(0, s.writes.evidence),
            proposals: Math.max(0, s.writes.proposals),
            memories: Math.max(0, typeof s.writes.memories === "number" ? s.writes.memories : 0),
          }
        : base.writes,
    consent: {
      aiPersonalization: s.consent?.aiPersonalization === true,
    },
  };
}

/** Lesson beat kind → stage Beat type for the SessionMachine mirror. */
function mirrorBeatType(kind: LessonBeatKind): Beat["type"] {
  switch (kind) {
    case "guided":
    case "check":
      return "interaction";
    case "micro":
    case "example":
      return "demonstration";
    case "celebrate":
    case "progress":
    case "next":
      return "celebration";
    default:
      return "narration";
  }
}

/**
 * Build a SessionMachine that mirrors the web lesson player's position so
 * `proposeTransition` enforces the same structural rules the stage engine
 * enforces for native sessions. The mirror carries beat KINDS only — no
 * learner content rides through it.
 */
export function buildMachineMirror(
  observation: LessonObservation,
  functioningLevel: TutorFunctioningLevel,
): SessionMachine {
  const kinds: LessonBeatKind[] =
    observation.beatKinds.length > 0
      ? observation.beatKinds
      : (Array.from({ length: observation.totalBeats }, (_, i) =>
          i === observation.beatIndex ? observation.beatKind : "micro",
        ) as LessonBeatKind[]);
  const beats: Beat[] = kinds.map((kind, i) => ({
    id: `b${i}`,
    type: mirrorBeatType(kind),
    tutorState: "idle",
  }));
  const index = Math.max(0, Math.min(observation.beatIndex, beats.length - 1));
  const currentKind = kinds[index] ?? observation.beatKind;
  const phase =
    mirrorBeatType(currentKind) === "celebration"
      ? "celebration"
      : index === 0
        ? "opening"
        : "core";
  return SessionMachine.restore(
    { learnerId: "mirror", functioningLevel: functioningLevel as FunctioningLevel, beats },
    {
      phase,
      currentBeatIndex: index,
      beats,
      totalBeats: beats.length,
      xpEarned: 0,
      coinsEarned: 0,
      correctCount: 0,
      totalAttempts: 0,
      startedAt: Date.now(),
      learnerId: "mirror",
      functioningLevel: functioningLevel as FunctioningLevel,
      answers: [],
      masteryDeltas: {},
      isComplete: false,
    },
  );
}

/** Compact persona context for the model — deterministic, no PII. */
export function buildPersonaContext(input: {
  def: TutorDefinition;
  negotiatedLevel: TutorFunctioningLevel;
  deliveryLevel: string;
  gradeBand?: string;
  curriculumFocusTitle?: string;
}): string {
  const { def } = input;
  const lines = [
    `You are ${def.persona.name}, an AIVO tutor (${def.subjects.join(", ")}). ${def.persona.tagline}`,
    `Learner: functioning level ${input.negotiatedLevel}` +
      (input.gradeBand ? `, grade band ${input.gradeBand}` : "") +
      `, delivery level ${input.deliveryLevel}.`,
    "You are observing a live lesson and choose ONE next move after each learner answer.",
    "Prefer the least intrusive effective move: advance while learning is on track; insert_scaffold or remediate after repeated misses on the same idea; offer_break when frustration or fatigue shows; end_early only when continuing would harm the learner.",
    "Keep any learner-visible text short, concrete, and encouraging — one or two sentences.",
  ];
  if (input.curriculumFocusTitle) {
    lines.push(`School syllabus focus this week: ${input.curriculumFocusTitle}.`);
  }
  return lines.join("\n");
}

function compactBrainSnapshot(brain: Record<string, unknown>): Record<string, unknown> {
  const pick = (key: string) => (brain[key] === undefined ? undefined : brain[key]);
  const snapshot: Record<string, unknown> = {
    functioning_level_profile: pick("functioning_level_profile"),
    grade_band: pick("grade_band"),
    mastery_levels: pick("mastery_levels"),
    preferred_modality: pick("preferred_modality"),
    modality_fit: pick("modality_fit"),
    accommodations: pick("accommodations"),
  };
  for (const k of Object.keys(snapshot)) {
    if (snapshot[k] === undefined) delete snapshot[k];
  }
  // Hard cap so a bloated brain row can't blow the prompt budget.
  const json = JSON.stringify(snapshot);
  return json.length > 4_000 ? { note: "snapshot too large; key fields only" } : snapshot;
}

// ── The orchestrator ─────────────────────────────────────────────────────────

export class AgentOrchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  /**
   * Run one agent turn for an open agent session. Never throws for model,
   * tool, or guard trouble — every non-action path returns a deterministic
   * decision so the lesson player can always fall back to today's flow.
   */
  async runTurn(input: {
    sessionId: string;
    learnerId: string;
    observation: LessonObservation;
    /** TutorDefinition resolver — injected so tests can use fixtures. */
    getDefinition(tutorKey: string): TutorDefinition | undefined;
  }): Promise<TurnDecision | { error: string; status: 403 | 404 | 409 }> {
    const now = this.deps.now ?? Date.now;
    const started = now();

    const session = await this.deps.store.loadSession(input.sessionId);
    if (!session) return { error: "agent session not found", status: 404 };
    if (session.sessionType !== "agent_lesson") {
      return { error: "not an agent session", status: 409 };
    }
    if (session.completedAt) return { error: "agent session is closed", status: 409 };
    if (session.learnerId !== input.learnerId) {
      return { error: "learner does not match session", status: 403 };
    }

    const state = parseAgentState(session.agentState, "nova");
    const def = input.getDefinition(state.tutorKey);
    if (!def) return { error: `unknown tutor "${state.tutorKey}"`, status: 409 };

    const drops: RungDrop[] = [];
    const ladder = AgentLadder.restore(state.ladder, {
      onDrop: (drop) => {
        drops.push(drop);
        logger.warn("agent ladder drop", { sessionId: input.sessionId, ...drop });
        // S13: A/B telemetry — rung drops are the pilot's key health signal.
        recordAgentRungDrop(state.tutorKey, drop);
        this.deps.onRungDrop?.(input.sessionId, drop);
      },
    });

    const digest = observationDigest(input.observation);
    const seq = state.seq + 1;
    const finish = async (
      decision: string,
      result: Omit<TurnDecision, "rung" | "seq" | "latencyMs">,
      extras: { action?: AgentWireAction | null; rationale?: string } = {},
    ): Promise<TurnDecision> => {
      const latencyMs = Math.max(0, Math.round(now() - started));
      // S13: A/B telemetry — one counter increment per turn (tutor × rung
      // × outcome class); the deterministic arm has no turns at all.
      recordAgentTurn(state.tutorKey, ladder.current(), decision);
      const nextState: AgentSessionState = { ...state, seq, ladder: ladder.snapshot() };
      await this.deps.store.saveAgentState(input.sessionId, nextState);
      await this.deps.store.insertTrace({
        tenantId: session.tenantId,
        sessionId: input.sessionId,
        learnerId: session.learnerId,
        tutorKey: state.tutorKey,
        seq,
        observationDigest: digest,
        action: extras.action ?? null,
        rationale: extras.rationale ?? "",
        decision,
        rung: ladder.current(),
        latencyMs,
      });
      return { ...result, rung: ladder.current(), seq, latencyMs };
    };

    // 1. Ladder gate — never consult a model the rung has retired.
    const beatClass = input.observation.beatKind === "check" ? "check" : "other";
    if (!ladder.shouldConsult(beatClass)) {
      return finish(`skipped:rung_${ladder.current()}`, {
        kind: "deterministic",
        action: null,
        effect: null,
        reason: `ladder_${ladder.current()}`,
      });
    }

    // 2. Envelope gate — spent sessions go deterministic without an LLM call.
    if (state.envelope.limit - state.envelope.used < ENVELOPE_FLOOR_TOKENS) {
      ladder.recordEnvelopeExhausted();
      return finish("skipped:envelope_exhausted", {
        kind: "deterministic",
        action: null,
        effect: null,
        reason: "envelope_exhausted",
      });
    }

    // 3. Policy: actions for this functioning level; tools we can execute.
    const allowedActions: readonly AgentActionKind[] = def.actionPolicy[
      state.negotiatedLevel
    ] ?? ["advance", "switch_modality", "offer_break", "end_early", "present_surface"];
    // S12: memory is offered only with policy + executor + consent aligned.
    const memoryEnabled =
      def.memoryPolicy.canRemember === true &&
      Boolean(this.deps.runMemoryTool) &&
      state.consent.aiPersonalization === true;
    const offeredTools = def.toolset.filter(
      (t) =>
        READ_TOOLS.has(t) ||
        (DOMAIN_TOOLS.has(t) && Boolean(this.deps.runDomainTool)) ||
        (WRITE_TOOLS.has(t) && Boolean(this.deps.runWriteTool)) ||
        (t === MEMORY_TOOL && memoryEnabled),
    );
    let brain = (session.brainContext ?? {}) as Record<string, unknown>;
    const subject = String(def.subjects[0] ?? "math");

    // 3b. Mid-session snapshot re-fetch (S10): frustration, a 2-miss
    // streak, or a beat running >2× the learner's processing speed means
    // the cached picture is stale — refresh it and pre-seed the result so
    // the model starts from current state without spending a roundtrip.
    let toolResults: Array<{ name: string; result: Record<string, unknown> }> = [];
    if (shouldRefetchSnapshot(input.observation, brain)) {
      try {
        const fresh = await this.deps.fetchBrainContext(session.learnerId);
        if (fresh && Object.keys(fresh).length > 0) {
          brain = { ...brain, ...fresh };
        }
        toolResults.push({
          name: "get_learner_snapshot",
          result: compactBrainSnapshot(brain),
        });
      } catch {
        // Stale context is still usable context — proceed without the refresh.
      }
    }

    const gradeBand =
      typeof brain.grade_band === "string" ? (brain.grade_band as string) : undefined;
    const focus = (brain as { curriculum_focus?: { title?: unknown } }).curriculum_focus;
    let personaContext = buildPersonaContext({
      def,
      negotiatedLevel: state.negotiatedLevel,
      deliveryLevel: state.deliveryLevel,
      gradeBand,
      curriculumFocusTitle: typeof focus?.title === "string" ? focus.title : undefined,
    });

    // S13: per-tutor onboarding specialisations.
    // Vigor — an active DAPE (adapted PE) plan changes what "advance" may
    // ask of the learner; surface it explicitly, not buried in a snapshot.
    const dape = (brain as { dape_profile?: { active?: boolean } }).dape_profile;
    if (dape?.active === true) {
      personaContext +=
        "\nThis learner has an ACTIVE DAPE (adapted physical education) plan: keep every movement or activity suggestion within the adapted track and never propose standard-intensity alternatives.";
    }
    // Harmony — emotional language comes from the reviewed SEL phrase bank.
    if (def.persona.id === "harmony") {
      personaContext += `\n\n${renderSelPhraseBankBlock()}`;
    }

    // S12: retrieval — top-k unexpired memories ride into the context as a
    // compact block. Read side shares the same consent + policy gate.
    if (memoryEnabled && this.deps.retrieveMemories) {
      try {
        const rows = await this.deps.retrieveMemories({
          tenantId: session.tenantId,
          learnerId: session.learnerId,
          tutorKey: state.tutorKey,
          k: MEMORY_TOP_K,
        });
        const block = renderMemoryContext(
          rows.map((r) => ({
            id: "",
            kind: r.kind,
            content: r.content,
            createdAt: "",
            expiresAt: "",
          })),
        );
        if (block) personaContext = `${personaContext}\n\n${block}`;
      } catch {
        // Memory retrieval is enrichment — a miss never blocks the turn.
      }
    }

    // 4. Model loop with tool roundtrips (caps mirrored on the ai-svc side).
    let aiResult: AiTurnResult | null = null;
    let usedTokens = 0;
    for (let roundtrip = 0; roundtrip <= MAX_TOOL_ROUNDTRIPS; roundtrip += 1) {
      try {
        aiResult = await this.deps.callAiTurn({
          tutor_key: state.tutorKey,
          tenant_id: session.tenantId,
          learner_id: session.learnerId,
          session_id: input.sessionId,
          persona_context: personaContext,
          observation: { ...input.observation },
          allowed_actions: [...allowedActions],
          allowed_tools: offeredTools.map((name) => ({
            name,
            ...(name === MEMORY_TOOL
              ? REMEMBER_TOOL_SCHEMA
              : (TOOL_SCHEMAS[name] ?? DOMAIN_TOOL_SCHEMAS[name] ?? WRITE_TOOL_SCHEMAS[name])),
          })),
          tool_results: toolResults,
          roundtrip,
          model_tier: "decision",
          token_envelope: {
            limit: state.envelope.limit,
            used: state.envelope.used + usedTokens,
          },
          delivery_level: state.deliveryLevel,
          functioning_level: state.negotiatedLevel,
        });
      } catch (err) {
        ladder.recordFailure(err instanceof Error ? err.message : String(err));
        return finish(`fallback:transport`, {
          kind: "deterministic",
          action: null,
          effect: null,
          reason: "ai_unreachable",
        });
      }
      usedTokens +=
        (aiResult.usage?.prompt_tokens ?? 0) + (aiResult.usage?.completion_tokens ?? 0);
      if (aiResult.kind !== "tool_request") break;
      const calls = aiResult.tool_calls ?? [];
      toolResults = [];
      for (const call of calls) {
        toolResults.push({
          name: call.name,
          result: await this.executeTool(call.name, call.arguments ?? {}, {
            tenantId: session.tenantId,
            sessionId: input.sessionId,
            learnerId: session.learnerId,
            tutorKey: state.tutorKey,
            subject,
            brain,
            observation: input.observation,
            state,
            def,
          }),
        });
      }
    }

    state.envelope = { ...state.envelope, used: state.envelope.used + usedTokens };
    if (state.envelope.limit - state.envelope.used < ENVELOPE_FLOOR_TOKENS) {
      ladder.recordEnvelopeExhausted();
    }
    const latency = Math.max(0, Math.round(now() - started));

    if (!aiResult || aiResult.kind !== "action" || !aiResult.action) {
      const reason = aiResult?.fallback_reason ?? "no_action";
      ladder.recordFailure(reason);
      return finish(`fallback:${reason}`.slice(0, 120), {
        kind: "deterministic",
        action: null,
        effect: null,
        reason: "agent_fallback",
      });
    }

    // 5. Structural guard — the SessionMachine mirror has the last word.
    const machine = buildMachineMirror(input.observation, state.negotiatedLevel);
    const verdict = machine.proposeTransition(aiResult.action);
    if (!verdict.accepted) {
      ladder.recordTurn(latency);
      return finish(`rejected:${verdict.reason}`.slice(0, 120), {
        kind: "deterministic",
        action: null,
        effect: null,
        reason: `guard_${verdict.reason}`,
      });
    }

    ladder.recordTurn(latency);
    return finish(`accepted:${aiResult.action.kind}`, {
      kind: "action",
      action: aiResult.action,
      effect: verdict.effect,
      reason: null,
    }, { action: aiResult.action, rationale: aiResult.rationale ?? "" });
  }

  /** Execute one tool. Errors become payloads — a flaky instrument never
   *  kills the turn; the model simply sees what it asked for failed. */
  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    ctx: {
      tenantId: string;
      sessionId: string;
      learnerId: string;
      tutorKey: string;
      subject: string;
      brain: Record<string, unknown>;
      observation: LessonObservation;
      state: AgentSessionState;
      def: TutorDefinition;
    },
  ): Promise<Record<string, unknown>> {
    try {
      switch (name) {
        case "get_learner_snapshot": {
          const brain = await this.deps.fetchBrainContext(ctx.learnerId);
          const merged = Object.keys(brain).length > 0 ? brain : ctx.brain;
          return compactBrainSnapshot(merged);
        }
        case "get_skill_position": {
          const skillId =
            typeof args.skill_id === "string" && args.skill_id
              ? args.skill_id
              : (ctx.observation.skillId ?? "unknown");
          const mastery = (ctx.brain.mastery_levels ?? {}) as Record<string, unknown>;
          return {
            skill_id: skillId,
            mastery: typeof mastery[skillId] === "number" ? mastery[skillId] : null,
            recent_miss_streak: ctx.observation.recentMissStreak ?? 0,
            attempts_on_beat: ctx.observation.attemptsOnBeat ?? 1,
            hints_used: ctx.observation.hintsUsed ?? 0,
          };
        }
        case "get_curriculum_context": {
          const focus = await this.deps.getCurriculumFocus(ctx.learnerId, ctx.subject);
          return focus
            ? { focus }
            : { note: "no active school syllabus for this subject this week" };
        }
        default:
          // Wave E (S10): domain tools route to the injected adapter belt.
          if (DOMAIN_TOOLS.has(name as AgentToolId) && this.deps.runDomainTool) {
            return await this.deps.runDomainTool(name, args, {
              learnerId: ctx.learnerId,
              observation: ctx.observation,
            });
          }
          // Wave E (S12): the memory tool — consent + policy + cap gated.
          if (name === MEMORY_TOOL && this.deps.runMemoryTool) {
            if (ctx.state.consent.aiPersonalization !== true) {
              return { error: "memory requires ai_personalization consent" };
            }
            if (ctx.def.memoryPolicy.canRemember !== true) {
              return { error: "this tutor's memory policy does not allow remembering" };
            }
            if (ctx.state.writes.memories >= WRITE_CAPS.memories) {
              return {
                error: `memory cap reached (${WRITE_CAPS.memories}/session) — decide without writing more`,
              };
            }
            const result = await this.deps.runMemoryTool(args, {
              tenantId: ctx.tenantId,
              sessionId: ctx.sessionId,
              learnerId: ctx.learnerId,
              tutorKey: ctx.tutorKey,
              allowedKinds: ctx.def.memoryPolicy.kinds,
            });
            if (!result.error && result.remembered === true) {
              ctx.state.writes.memories += 1;
            }
            return result;
          }
          // Wave E (S11): write tools — per-session caps enforced HERE so
          // the cap survives stateless turns via agent_state.writes.
          if (WRITE_TOOLS.has(name as AgentToolId) && this.deps.runWriteTool) {
            if (name === "file_evidence" && ctx.state.writes.evidence >= WRITE_CAPS.evidence) {
              return {
                error: `evidence cap reached (${WRITE_CAPS.evidence}/session) — decide without filing more`,
              };
            }
            if (
              name === "propose_recommendation" &&
              ctx.state.writes.proposals >= WRITE_CAPS.proposals
            ) {
              return {
                error: `proposal cap reached (${WRITE_CAPS.proposals}/session)`,
              };
            }
            const result = await this.deps.runWriteTool(name, args, {
              tenantId: ctx.tenantId,
              sessionId: ctx.sessionId,
              learnerId: ctx.learnerId,
              tutorKey: ctx.tutorKey,
              observation: ctx.observation,
            });
            // Count only effective writes — a validation error costs nothing.
            if (!result.error) {
              if (name === "file_evidence") ctx.state.writes.evidence += 1;
              if (name === "propose_recommendation" && result.proposed === true) {
                ctx.state.writes.proposals += 1;
              }
            }
            return result;
          }
          return { error: `tool "${name}" is not executable here` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
