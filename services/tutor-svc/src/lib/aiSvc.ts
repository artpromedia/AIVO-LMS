/**
 * Tiny HTTP client for ai-svc Speech Buddy endpoints.
 *
 * tutor-svc is the only intended caller of these internal endpoints. The
 * `x-internal-key` header is required and read from `INTERNAL_SERVICE_KEY`
 * (matches the comms-svc convention).
 */

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`tutor-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3005");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

interface OwnerCtx {
  tenantId: string;
  learnerId: string;
}

function ownerHeaders(owner?: OwnerCtx): Record<string, string> {
  if (!owner) return {};
  return {
    "x-aivo-tenant-id": owner.tenantId,
    "x-aivo-learner-id": owner.learnerId,
  };
}

async function call<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST"; signal?: AbortSignal },
): Promise<T> {
  const res = await fetch(`${AI_SVC_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-internal-key": INTERNAL_KEY,
      ...(init.headers || {}),
    },
    signal: init.signal,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const detail = body?.detail || body?.error || res.statusText;
    const err: any = new Error(`ai-svc ${path} failed: ${res.status} ${detail}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

export interface StartSessionResponse {
  sessionId: string;
  ageBand: "3-5" | "6-9" | "10-12" | "13-15";
  locale: string;
  nicknameToken: string;
  state: string;
  startedAt: string;
  targetedSkills: string[];
}

export interface TurnResponse {
  buddyText: string;
  buddyAudioBase64: string;
  nextState: string;
  ended: boolean;
  endedReason: string | null;
  trace: {
    correlation_id: string;
    stt_ms: number;
    safety_in_ms: number;
    planner_ms: number;
    safety_out_ms: number;
    tts_ms: number;
    total_ms: number;
  };
  safetyFlags: Array<{
    category: string;
    severity: "soft" | "hard";
    source: "child_input" | "buddy_output";
    layer: "regex" | "classifier" | "llm_judge";
    correlationId: string;
    raisedAt: string;
  }>;
  skillEvidence: Array<{ skill: string; weight: number }>;
}

export interface EndSessionResponse {
  sessionId: string;
  endedReason: string;
  durationSeconds: number;
  turnCount: number;
  skillEvidenceTotals: Record<string, number>;
  badgesAwarded: string[];
  reflectionPrompts: string[];
  questAssigned: { quest: string; skill: string } | null;
  terminalSafetyFlag: {
    category: string;
    severity: string;
    correlationId: string;
    raisedAt: string;
  } | null;
  transcriptCiphertext: {
    tenant_id: string;
    nonce: string;
    ciphertext: string;
    algorithm: string;
  } | null;
}

export const aiSvc = {
  startSession(body: {
    tenantId: string;
    learnerId: string;
    ageBand: string;
    locale: string;
    consentRecordId: string;
    targetedSkills?: string[];
  }) {
    return call<StartSessionResponse>("/api/ai/speech-buddy/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  runTurn(
    sessionId: string,
    body: { text?: string; audioBase64?: string; mimeType?: string },
    owner?: OwnerCtx,
    opts?: { signal?: AbortSignal },
  ) {
    return call<TurnResponse>(
      `/api/ai/speech-buddy/sessions/${encodeURIComponent(sessionId)}/turn`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: ownerHeaders(owner),
        signal: opts?.signal,
      },
    );
  },
  endSession(sessionId: string, reason: string, owner?: OwnerCtx) {
    return call<EndSessionResponse>(
      `/api/ai/speech-buddy/sessions/${encodeURIComponent(sessionId)}/end`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        headers: ownerHeaders(owner),
      },
    );
  },
  getSession(sessionId: string, owner?: OwnerCtx) {
    return call<{
      sessionId: string;
      state: string;
      ageBand: string;
      locale: string;
      targetedSkills: string[];
    }>(`/api/ai/speech-buddy/sessions/${encodeURIComponent(sessionId)}`, {
      method: "GET",
      headers: ownerHeaders(owner),
    });
  },
};
export type { OwnerCtx };

export const __testing = { AI_SVC_URL, INTERNAL_KEY };
