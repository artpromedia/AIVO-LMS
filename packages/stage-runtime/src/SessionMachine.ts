/**
 * SessionMachine — pure-TS state machine that drives a tutor session
 * through its beat sequence. Designed to be:
 *
 *   1. Serialisable — `getState()` returns a snapshot that can be persisted
 *      to MMKV (mobile offline outbox) or postgres (resume on reconnect)
 *      and replayed via `restore()` without losing any progress.
 *   2. Platform-agnostic — no React, no DOM, no React Native. The matching
 *      `useSessionFlow()` hook in this package is the React adapter.
 *   3. Pedagogically faithful — mastery deltas are computed per-beat from
 *      the same correctness signal the existing `apps/web` stage uses
 *      (correct → +0.05, incorrect → -0.02), so swapping a session over
 *      to this engine doesn't change reported mastery.
 */
import type { Beat, SessionState, SessionPhase, FunctioningLevel } from "@aivo/stage-ui";

const MASTERY_DELTA_CORRECT = 0.05;
const MASTERY_DELTA_INCORRECT = -0.02;
const XP_PER_CORRECT = 10;
const COIN_PER_CORRECT = 1;

/** Minimum data the machine needs to bootstrap a session. */
export interface TutorSession {
  sessionId?: string;
  learnerId: string;
  learnerName?: string;
  functioningLevel: FunctioningLevel;
  beats: Beat[];
  initialPhase?: SessionPhase;
}

/** Per-beat answer record kept by the machine for mastery rollups. */
export interface AnswerRecord {
  beatId: string;
  answer: string;
  isCorrect: boolean;
  recordedAt: number;
}

/** Snapshot returned from `getState()` and accepted by `restore()`. */
export interface SessionSnapshot extends SessionState {
  answers: AnswerRecord[];
  masteryDeltas: Record<string, number>;
  isComplete: boolean;
}

function isInteractionBeat(beat: Beat): boolean {
  return beat.type === "interaction" && Boolean(beat.interaction?.choices?.length);
}

function correctAnswerFor(beat: Beat): string | undefined {
  if (beat.interaction?.correctAnswer) return beat.interaction.correctAnswer;
  const correct = beat.interaction?.choices?.find((c) => c.isCorrect);
  return correct?.id;
}

export class SessionMachine {
  private session: TutorSession;
  private state: SessionState;
  private answers: AnswerRecord[] = [];
  private masteryDeltas: Record<string, number> = {};
  private complete = false;

  constructor(session: TutorSession) {
    if (!session) {
      throw new Error("SessionMachine: session argument is required");
    }
    if (!Array.isArray(session.beats)) {
      throw new Error("SessionMachine: session.beats must be an array");
    }
    this.session = session;
    this.state = {
      phase: session.initialPhase ?? (session.beats.length === 0 ? "complete" : "loading"),
      currentBeatIndex: 0,
      beats: session.beats,
      totalBeats: session.beats.length,
      xpEarned: 0,
      coinsEarned: 0,
      correctCount: 0,
      totalAttempts: 0,
      startedAt: Date.now(),
      learnerId: session.learnerId,
      sessionId: session.sessionId,
      learnerName: session.learnerName,
      functioningLevel: session.functioningLevel,
    };
    if (session.beats.length === 0) {
      this.complete = true;
    }
  }

  /** Return the current beat without advancing. */
  currentBeat(): Beat | null {
    if (this.complete) return null;
    return this.state.beats[this.state.currentBeatIndex] ?? null;
  }

  /**
   * Advance to the next beat and return it. When the queue is exhausted,
   * marks the session complete and returns null.
   */
  nextBeat(): Beat | null {
    if (this.complete) return null;
    const nextIndex = this.state.currentBeatIndex + 1;
    if (nextIndex >= this.state.totalBeats) {
      this.state.currentBeatIndex = this.state.totalBeats;
      this.state.phase = "complete";
      this.complete = true;
      return null;
    }
    this.state.currentBeatIndex = nextIndex;
    this.state.phase = this.derivePhase(this.state.beats[nextIndex]);
    return this.state.beats[nextIndex] ?? null;
  }

  /**
   * Record a learner's answer to a specific beat. The beat must be an
   * interaction beat with a defined correct answer; otherwise this is a
   * no-op so callers can pass narration or demonstration beats through
   * defensively without conditional checks.
   */
  recordAnswer(beatId: string, answer: string): AnswerRecord | null {
    if (this.complete) return null;
    const beat = this.state.beats.find((b) => b.id === beatId);
    if (!beat) {
      throw new Error(`SessionMachine.recordAnswer: unknown beatId ${beatId}`);
    }
    if (!isInteractionBeat(beat)) return null;

    const expected = correctAnswerFor(beat);
    const isCorrect = expected !== undefined && expected === answer;
    const record: AnswerRecord = {
      beatId,
      answer,
      isCorrect,
      recordedAt: Date.now(),
    };
    this.answers.push(record);

    this.state.totalAttempts += 1;
    if (isCorrect) {
      this.state.correctCount += 1;
      this.state.xpEarned += XP_PER_CORRECT;
      this.state.coinsEarned += COIN_PER_CORRECT;
    }

    // Mastery deltas keyed by interaction type — keeps the rollup small
    // for the consumer (admin reporting only cares about per-skill totals,
    // not per-beat).
    const skillKey = beat.interaction?.type ?? "unknown";
    const delta = isCorrect ? MASTERY_DELTA_CORRECT : MASTERY_DELTA_INCORRECT;
    this.masteryDeltas[skillKey] = (this.masteryDeltas[skillKey] ?? 0) + delta;

    return record;
  }

  /** Returns a serialisable snapshot of the full machine state. */
  getState(): SessionSnapshot {
    return {
      ...this.state,
      answers: [...this.answers],
      masteryDeltas: { ...this.masteryDeltas },
      isComplete: this.complete,
    };
  }

  /** True once the queue is exhausted; equivalent to `phase === "complete"`. */
  isComplete(): boolean {
    return this.complete;
  }

  /**
   * Compute the current progress as a 0..1 fraction. Useful for ProgressPath
   * without requiring callers to inspect the full snapshot.
   */
  progress(): number {
    if (this.state.totalBeats === 0) return 1;
    return Math.min(1, this.state.currentBeatIndex / this.state.totalBeats);
  }

  /**
   * Restore a machine from a previously persisted snapshot — used by the
   * mobile offline outbox flush path and by SSR hydration on the web.
   */
  static restore(session: TutorSession, snapshot: SessionSnapshot): SessionMachine {
    const machine = new SessionMachine(session);
    machine.state = {
      ...machine.state,
      ...snapshot,
      // beats always come from the canonical session, never the snapshot,
      // so a stale on-disk snapshot can't replay against newer content.
      beats: session.beats,
      totalBeats: session.beats.length,
    };
    machine.answers = [...snapshot.answers];
    machine.masteryDeltas = { ...snapshot.masteryDeltas };
    machine.complete = snapshot.isComplete;
    return machine;
  }

  private derivePhase(beat: Beat | undefined): SessionPhase {
    if (!beat) return "complete";
    switch (beat.type) {
      case "celebration":
        return "celebration";
      case "interaction":
        return "core";
      case "demonstration":
        return "warmup";
      case "narration":
      default:
        return this.state.currentBeatIndex === 0 ? "opening" : "core";
    }
  }
}
