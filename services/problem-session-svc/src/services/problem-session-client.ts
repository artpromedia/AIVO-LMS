/**
 * HTTP client used by adapter sites (assessment-svc baseline, learning-svc
 * sessions, tutor-svc homework, web stage/discovery hooks) to push evidence
 * to the problem-session ledger.
 *
 * The client is flag-aware: when `AIVO_FEATURE_PROBLEM_SESSION_LEDGER` is
 * disabled, every method becomes a no-op. Network failures never propagate
 * to callers — the ledger is evidence, not the source of truth.
 */

import { enterpriseFeatureFlags } from "@aivo/feature-flags";

const DEFAULT_BASE_URL = process.env.PROBLEM_SESSION_SVC_URL ?? "http://localhost:3061";

export interface ProblemSessionClientOptions {
  baseUrl?: string;
  enabled?: boolean;
  fetchImpl?: typeof fetch;
  onError?: (error: unknown) => void;
}

export interface CreateSessionAdapterInput {
  tenantId: string;
  learnerId: string;
  subject: string;
  skillCode?: string;
  standardCode?: string;
  source: "baseline" | "lesson" | "homework" | "tutor_chat" | "practice";
  sourceSessionId?: string;
  tutorSku?: string;
  metadata?: Record<string, unknown>;
}

export interface AppendEventAdapterInput {
  problemSessionId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export class ProblemSessionClient {
  private readonly baseUrl: string;
  private readonly enabled: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly onError: (error: unknown) => void;

  constructor(options: ProblemSessionClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.enabled = options.enabled ?? enterpriseFeatureFlags.problemSessionLedger;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.onError = options.onError ?? (() => undefined);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async createSession(input: CreateSessionAdapterInput): Promise<{ id: string } | undefined> {
    if (!this.enabled) return undefined;
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/problem-sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) return undefined;
      const body = (await response.json()) as { id: string };
      return body;
    } catch (error) {
      this.onError(error);
      return undefined;
    }
  }

  async appendEvent(input: AppendEventAdapterInput): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.fetchImpl(
        `${this.baseUrl}/api/problem-sessions/${encodeURIComponent(input.problemSessionId)}/events`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventType: input.eventType, payload: input.payload ?? {} }),
        },
      );
    } catch (error) {
      this.onError(error);
    }
  }

  async completeSession(problemSessionId: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.fetchImpl(
        `${this.baseUrl}/api/problem-sessions/${encodeURIComponent(problemSessionId)}/complete`,
        { method: "POST" },
      );
    } catch (error) {
      this.onError(error);
    }
  }
}

export function createProblemSessionClient(
  options: ProblemSessionClientOptions = {},
): ProblemSessionClient {
  return new ProblemSessionClient(options);
}
