/**
 * Server-authoritative adaptive-baseline run-loop.
 *
 * The route layer (`routes/learner-profile.ts`) persists only the engine
 * session state; this module is the pure brain that advances it. Pulling
 * the logic out of the handlers makes the run-loop unit-testable (no DB,
 * no Fastify) and lets us enforce integrity the handlers previously
 * skipped:
 *
 *   - **Anti-spoof**: the responded item is resolved from the
 *     server-supplied `bank` by id, so a client cannot invent an
 *     easier/harder difficulty than the calibrated item carries.
 *   - **Sequence integrity**: a response must answer the item the server
 *     last served (`lastServedItemId`); stale/forged answers are rejected.
 *   - **No double-counting**: an item already administered cannot be
 *     recorded twice.
 *
 * The engine itself (`@aivo/adaptive-baseline`) stays the single source of
 * truth for θ updates, item selection, and stop decisions.
 */
import {
  initBaseline,
  pickNextItem,
  recordResponse,
  shouldStop,
  finalize,
  type BaselineItem,
  type BaselineState,
  type ItemResponse,
} from "@aivo/adaptive-baseline";

export type StopDecision = ReturnType<typeof shouldStop>;
export type BaselineResult = ReturnType<typeof finalize>;

/** Session = engine state + the id of the item we last handed the client. */
export interface RunSession {
  state: BaselineState;
  lastServedItemId: string | null;
}

/** jsonb-friendly shape persisted in `adaptive_baseline_sessions.state`. */
export interface SerializedRunSession {
  theta: number;
  infoSum: number;
  administered: ItemResponse[];
  coveredSkills: string[];
  readingDifficulty: boolean;
  /** Optional so legacy rows (pre-integrity) hydrate cleanly. */
  lastServedItemId?: string | null;
}

export function serializeSession(s: RunSession): SerializedRunSession {
  return {
    theta: s.state.theta,
    infoSum: s.state.infoSum,
    administered: s.state.administered,
    coveredSkills: [...s.state.coveredSkills],
    readingDifficulty: s.state.readingDifficulty,
    lastServedItemId: s.lastServedItemId,
  };
}

export function hydrateSession(s: SerializedRunSession): RunSession {
  return {
    state: {
      theta: s.theta,
      infoSum: s.infoSum,
      administered: s.administered ?? [],
      coveredSkills: new Set(s.coveredSkills ?? []),
      readingDifficulty: !!s.readingDifficulty,
    },
    lastServedItemId: s.lastServedItemId ?? null,
  };
}

export interface StartInput {
  bank: BaselineItem[];
  priorTheta?: number;
  readingDifficulty?: boolean;
}

export interface StartResult {
  session: RunSession;
  nextItem: BaselineItem | null;
  stop: StopDecision;
}

/** Open a fresh session and select the first item from the bank. */
export function startRun(input: StartInput): StartResult {
  const state = initBaseline({
    priorTheta: input.priorTheta,
    readingDifficulty: input.readingDifficulty,
  });
  const stop = shouldStop(state);
  const nextItem = !stop.stop
    ? pickNextItem(state, input.bank, { applyFrustrationCeiling: true })
    : null;
  return {
    session: { state, lastServedItemId: nextItem?.id ?? null },
    nextItem,
    stop,
  };
}

export type RespondRejection = "unexpected_item" | "unknown_item" | "duplicate_item";

export type RespondResult =
  | {
      ok: true;
      session: RunSession;
      nextItem: BaselineItem | null;
      stop: StopDecision;
      theta: number;
    }
  | { ok: false; reason: RespondRejection };

export interface RespondInput {
  session: RunSession;
  itemId: string;
  correct: boolean;
  bank: BaselineItem[];
  responseTimeMs?: number;
  affect?: ItemResponse["affect"];
  consumedModality?: ItemResponse["consumedModality"];
}

/**
 * Record an answer and select the next item. Rejects (without mutating the
 * session) when the answer fails an integrity check.
 */
export function respondToItem(input: RespondInput): RespondResult {
  const { session, itemId, bank } = input;

  // Sequence integrity: must answer the item we last served. Skipped when
  // the session predates integrity tracking (lastServedItemId === null).
  if (session.lastServedItemId !== null && itemId !== session.lastServedItemId) {
    return { ok: false, reason: "unexpected_item" };
  }

  // Anti-spoof: the authoritative item comes from the bank, not the client.
  const item = bank.find((b) => b.id === itemId);
  if (!item) return { ok: false, reason: "unknown_item" };

  // No double-counting.
  if (session.state.administered.some((r) => r.itemId === itemId)) {
    return { ok: false, reason: "duplicate_item" };
  }

  const response: ItemResponse = {
    itemId,
    correct: input.correct,
    responseTimeMs: input.responseTimeMs ?? 0,
    ...(input.affect ? { affect: input.affect } : {}),
    ...(input.consumedModality ? { consumedModality: input.consumedModality } : {}),
  };
  const state = recordResponse({ state: session.state, item, response });
  const stop = shouldStop(state);
  const nextItem = !stop.stop ? pickNextItem(state, bank, { applyFrustrationCeiling: true }) : null;

  return {
    ok: true,
    session: { state, lastServedItemId: nextItem?.id ?? null },
    nextItem,
    stop,
    theta: state.theta,
  };
}

/** Produce the final placement + learning profile. */
export function finalizeRun(session: RunSession, bank: BaselineItem[]): BaselineResult {
  return finalize(session.state, bank);
}
