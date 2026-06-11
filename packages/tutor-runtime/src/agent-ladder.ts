/**
 * Wave E (S8) — the agent degradation ladder.
 *
 * Agentic mode is never load-bearing. Every session runs on one of three
 * rungs, and drops are STICKY for the session (a struggling integration
 * must not flap):
 *
 *   FULL          → the agent is consulted after every learner response.
 *   CHECKPOINT    → the agent is consulted only at check-for-understanding
 *                   beats; everything else advances deterministically.
 *   DETERMINISTIC → today's exact pre-agent behaviour; the agent is out of
 *                   the loop entirely.
 *
 * Drop triggers (any one):
 *   - p95 turn latency over the budget (rolling window) — the learner
 *     NEVER waits on a slow agent;
 *   - consecutive turn failures (fallbacks / transport errors);
 *   - the session token envelope exhausted.
 *
 * Pure + injectable clock so every rule is unit-testable; the host wires
 * `onDrop` to its ops alerting (tutor-svc → emitDegradation-style pager).
 */

export type AgentRung = "full" | "checkpoint" | "deterministic";

export interface LadderConfig {
  /** Rolling latency window size (turns). */
  latencyWindow: number;
  /** p95 latency budget in ms. Default 1500 — a beat-to-beat pause. */
  p95BudgetMs: number;
  /** Consecutive failed turns before dropping a rung. */
  maxConsecutiveFailures: number;
}

export const DEFAULT_LADDER_CONFIG: LadderConfig = {
  latencyWindow: 8,
  p95BudgetMs: 1500,
  maxConsecutiveFailures: 2,
};

export interface RungDrop {
  from: AgentRung;
  to: AgentRung;
  trigger: "latency_budget" | "consecutive_failures" | "envelope_exhausted";
  detail: string;
}

const ORDER: AgentRung[] = ["full", "checkpoint", "deterministic"];

export function nextRungDown(rung: AgentRung): AgentRung {
  const i = ORDER.indexOf(rung);
  return ORDER[Math.min(i + 1, ORDER.length - 1)]!;
}

export function p95(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx]!;
}

export class AgentLadder {
  private rung: AgentRung = "full";
  private latencies: number[] = [];
  private consecutiveFailures = 0;
  private readonly config: LadderConfig;
  private readonly onDrop?: (drop: RungDrop) => void;

  constructor(opts: { config?: Partial<LadderConfig>; onDrop?: (drop: RungDrop) => void } = {}) {
    this.config = { ...DEFAULT_LADDER_CONFIG, ...opts.config };
    this.onDrop = opts.onDrop;
  }

  current(): AgentRung {
    return this.rung;
  }

  /** Should the agent be consulted for this beat on the current rung? */
  shouldConsult(beatKind: "check" | "other"): boolean {
    if (this.rung === "deterministic") return false;
    if (this.rung === "checkpoint") return beatKind === "check";
    return true;
  }

  /** Record a successful agent turn. Success resets the failure streak but
   *  latency over budget still counts toward the p95 trigger. */
  recordTurn(latencyMs: number): void {
    this.consecutiveFailures = 0;
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.config.latencyWindow) {
      this.latencies.shift();
    }
    if (
      this.latencies.length >= Math.min(4, this.config.latencyWindow) &&
      p95(this.latencies) > this.config.p95BudgetMs
    ) {
      this.drop("latency_budget", `p95 ${Math.round(p95(this.latencies))}ms > ${this.config.p95BudgetMs}ms`);
      this.latencies = [];
    }
  }

  /** Record a failed turn (fallback result or transport error). */
  recordFailure(detail: string): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.drop("consecutive_failures", detail);
      this.consecutiveFailures = 0;
    }
  }

  /** The session token envelope is spent — straight to deterministic. */
  recordEnvelopeExhausted(): void {
    if (this.rung !== "deterministic") {
      const from = this.rung;
      this.rung = "deterministic";
      this.onDrop?.({
        from,
        to: "deterministic",
        trigger: "envelope_exhausted",
        detail: "session token envelope exhausted",
      });
    }
  }

  private drop(trigger: RungDrop["trigger"], detail: string): void {
    if (this.rung === "deterministic") return;
    const from = this.rung;
    this.rung = nextRungDown(this.rung);
    this.onDrop?.({ from, to: this.rung, trigger, detail });
  }
}
