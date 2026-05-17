/**
 * Problem-session ledger types (mirrors services/problem-session-svc).
 * Sprint 02 records each beat outcome to the ledger so that the brain
 * snapshot service in Sprint 06 can produce real recommendations.
 */

export interface ProblemSessionRecord {
  sessionId: string;
  learnerId: string;
  beatId: string;
  skill?: string;
  outcome: "correct" | "incorrect" | "partial" | "skipped";
  responseTimeMs: number;
  timestamp: string;
}
