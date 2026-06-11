/**
 * Wave E (S9) — web-v2 server-side client for the tutor-svc agent
 * session routes (open / turn / close).
 *
 * Same trust model as `tutor-curriculum.ts`: the BFF has already enforced
 * session + role + learner-scope + consent, so we call tutor-svc as a
 * trusted service via the shared `INTERNAL_SERVICE_TOKEN`
 * (`x-service-token`); tutor-svc re-anchors tenant from the learner row.
 *
 * Browser code MUST NOT import this module (it references the token).
 *
 * Live only when `INTERNAL_SERVICE_TOKEN` is set. There is intentionally
 * NO dev in-memory fallback for the agent loop: without the token the
 * feature reports itself unavailable and the lesson player stays on
 * today's deterministic path (Playwright exercises the loop by stubbing
 * this network seam).
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import type { AgentTurnDecision } from "@/lib/learner/agent-directives";

export function isLiveTutorAgent(): boolean {
  return Boolean(serverEnv.INTERNAL_SERVICE_TOKEN);
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-service-token": serverEnv.INTERNAL_SERVICE_TOKEN ?? "",
  };
}

function base(): string {
  return serverEnv.TUTOR_SVC_URL.replace(/\/$/, "");
}

export interface AgentOpenResult {
  sessionId: string;
  tutorKey: string;
  tutorName: string;
  negotiatedLevel: string;
  rung: string;
}

export async function tutorAgentOpen(input: {
  learnerId: string;
  tutorKey: string;
  lessonRunId: string;
  gradeBand?: string | null;
  functioningLevel?: string | null;
}): Promise<AgentOpenResult> {
  const res = await fetch(`${base()}/api/tutor/agent/session/open`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS),
    body: JSON.stringify({
      learnerId: input.learnerId,
      tutorKey: input.tutorKey,
      lessonRunId: input.lessonRunId,
      gradeBand: input.gradeBand ?? undefined,
      functioningLevel: input.functioningLevel ?? undefined,
      deliveryLevel: input.gradeBand ?? undefined,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`tutor-svc agent open failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as AgentOpenResult;
}

export async function tutorAgentTurn(input: {
  sessionId: string;
  learnerId: string;
  observation: Record<string, unknown>;
}): Promise<AgentTurnDecision> {
  const res = await fetch(
    `${base()}/api/tutor/agent/session/${encodeURIComponent(input.sessionId)}/turn`,
    {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS),
      body: JSON.stringify({ learnerId: input.learnerId, observation: input.observation }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`tutor-svc agent turn failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as AgentTurnDecision;
}

export interface AgentCloseInput {
  sessionId: string;
  reason?: string;
  /** S11 — digest fields the lesson completion already derived; they ride
   *  into the agent's parent-note composition. */
  learnerFirstName?: string;
  checksCorrect?: number;
  checksTotal?: number;
  beatsCompleted?: number;
  locale?: string;
}

export interface AgentCloseResult {
  closed: boolean;
  /** Agent-composed, ai-svc quality-gated parent note (S11), or null. */
  parentNote: string | null;
}

/** Close the agent session; returns the composed parent note when the
 *  agent made decisions this session. Throws on transport trouble. */
export async function tutorAgentClose(input: AgentCloseInput): Promise<AgentCloseResult> {
  const res = await fetch(
    `${base()}/api/tutor/agent/session/${encodeURIComponent(input.sessionId)}/close`,
    {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(serverEnv.AIVO_SERVICE_TIMEOUT_MS),
      body: JSON.stringify({
        reason: input.reason ?? "player_done",
        learnerFirstName: input.learnerFirstName,
        checksCorrect: input.checksCorrect,
        checksTotal: input.checksTotal,
        beatsCompleted: input.beatsCompleted,
        locale: input.locale,
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`tutor-svc agent close failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const body = (await res.json()) as { parentNote?: string | null };
  return {
    closed: true,
    parentNote: typeof body.parentNote === "string" && body.parentNote ? body.parentNote : null,
  };
}

/** Best-effort close — a failed close must never block the lesson exit. */
export async function tutorAgentCloseSafe(input: AgentCloseInput): Promise<AgentCloseResult> {
  try {
    return await tutorAgentClose(input);
  } catch (err) {
    logger.warn(
      {
        feature: "tutor-agent",
        sessionId: input.sessionId,
        err: err instanceof Error ? err.message : String(err),
      },
      "[tutor-agent] close failed (non-blocking)",
    );
    return { closed: false, parentNote: null };
  }
}
