import type {
  ProblemSessionAttemptRecord,
  ProblemSessionEventRecord,
} from "./problem-session-store.js";

export interface ProblemSessionSummary {
  attempts: number;
  correctAttempts: number;
  hintCount: number;
  eraserCount: number;
  toolChangeCount: number;
  averageLatencyMs: number;
  bestScore?: number;
  successRate: number;
}

export function summarizeAttempts(attempts: ProblemSessionAttemptRecord[]): ProblemSessionSummary {
  if (attempts.length === 0) {
    return {
      attempts: 0,
      correctAttempts: 0,
      hintCount: 0,
      eraserCount: 0,
      toolChangeCount: 0,
      averageLatencyMs: 0,
      successRate: 0,
    };
  }
  let correct = 0;
  let hint = 0;
  let eraser = 0;
  let toolChange = 0;
  let latencyTotal = 0;
  let bestScore: number | undefined;
  for (const attempt of attempts) {
    if (attempt.correct) correct += 1;
    hint += attempt.hintCount;
    eraser += attempt.eraserCount;
    toolChange += attempt.toolChangeCount;
    latencyTotal += attempt.latencyMs;
    if (typeof attempt.score === "number") {
      if (bestScore === undefined || attempt.score > bestScore) bestScore = attempt.score;
    }
  }
  return {
    attempts: attempts.length,
    correctAttempts: correct,
    hintCount: hint,
    eraserCount: eraser,
    toolChangeCount: toolChange,
    averageLatencyMs: Math.round(latencyTotal / attempts.length),
    bestScore,
    successRate: correct / attempts.length,
  };
}

export function countEventTypes(events: ProblemSessionEventRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
  }
  return counts;
}
