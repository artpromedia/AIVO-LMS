/**
 * Tutor-agent A/B telemetry (Wave E S13).
 *
 * One counter, three labels — enough to drive the pilot dashboards:
 *
 *   agent_turns_total{tutor, rung, outcome}
 *
 *   tutor   — registry key (nova, sage, …)
 *   rung    — degradation-ladder rung the turn ran on
 *             (full | checkpoint | deterministic)
 *   outcome — decision class: accepted | rejected | fallback | skipped
 *
 * Read together with the lesson-outcome tables this gives the A/B story:
 * the "arm" of a lesson is observable from whether its turns exist at all
 * (agentic arm) and which rung served them; the deterministic arm simply
 * has no rows. Rung drops additionally emit a warn log for on-call.
 */
import { createCounter, createLogger, type Logger } from "./index.js";

export type AgentTurnOutcome = "accepted" | "rejected" | "fallback" | "skipped";

let _logger: Logger | undefined;
function logger(): Logger {
  return (_logger ??= createLogger("observability.agent-metrics"));
}

let _agentTurns: ReturnType<typeof createCounter> | undefined;
function agentTurns(): ReturnType<typeof createCounter> {
  return (_agentTurns ??= createCounter("agent_turns_total", ["tutor", "rung", "outcome"]));
}

let _rungDrops: ReturnType<typeof createCounter> | undefined;
function rungDrops(): ReturnType<typeof createCounter> {
  return (_rungDrops ??= createCounter("agent_rung_drops_total", ["tutor", "to", "trigger"]));
}

/** Decision string (e.g. "accepted:advance", "fallback:transport") → class. */
export function agentOutcomeClass(decision: string): AgentTurnOutcome {
  if (decision.startsWith("accepted")) return "accepted";
  if (decision.startsWith("rejected")) return "rejected";
  if (decision.startsWith("fallback")) return "fallback";
  return "skipped";
}

export function recordAgentTurn(tutor: string, rung: string, decision: string): void {
  agentTurns().increment(1, { tutor, rung, outcome: agentOutcomeClass(decision) });
}

export function recordAgentRungDrop(
  tutor: string,
  drop: { from: string; to: string; trigger: string; detail?: string },
): void {
  rungDrops().increment(1, { tutor, to: drop.to, trigger: drop.trigger });
  logger().warn("agent_rung_drop", {
    tutor,
    from: drop.from,
    to: drop.to,
    trigger: drop.trigger,
    detail: drop.detail,
  });
}
