/**
 * Client for the assessment-svc adaptive-baseline *streaming* run-loop.
 *
 * Where `baseline-adaptive.ts` adapts locally over a pre-generated pool,
 * this drives the service session so θ state + item selection are
 * server-authoritative and resumable:
 *
 *   POST /api/assessments/adaptive-baseline/:learnerId/start
 *   POST /api/assessments/adaptive-baseline/:learnerId/respond
 *   POST /api/assessments/adaptive-baseline/:learnerId/finalize
 *
 * Each call returns a tagged result so the runner can fall back to the
 * local adaptive path on any failure (mirrors the baseline-llm.ts
 * discipline). The candidate bank is sent with each call — the service is
 * stateless w.r.t. items and re-resolves the answered item from the bank,
 * so difficulty can't be spoofed.
 *
 * Parity reference:
 *   - services/assessment-svc/src/routes/learner-profile.ts
 *   - services/assessment-svc/src/services/adaptive-baseline-runner.ts
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import type { BaselineItem, ItemResponse, StopDecision } from "@aivo/adaptive-baseline";
import type { BaselineQuestion } from "@/lib/db/types";
import { questionToBaselineItem } from "./baseline-adaptive";

export const DEFAULT_STREAM_TIMEOUT_MS = 10_000;

export type StreamFailureReason =
  | "network_error"
  | "timeout"
  | "non_2xx"
  | "invalid_json"
  | "response_rejected";

type Fail = {
  ok: false;
  reason: StreamFailureReason;
  status?: number;
  /** Server-supplied rejection reason on a 409 (e.g. "unexpected_item"). */
  rejection?: string;
  message: string;
};

export interface StartRunResponse {
  sessionId: string;
  learnerId: string;
  nextItem: BaselineItem | null;
  stop: StopDecision;
}
export interface RespondRunResponse {
  sessionId: string;
  nextItem: BaselineItem | null;
  stop: StopDecision;
  theta: number;
}
export interface FinalizeRunResponse {
  sessionId: string;
  finalTheta: number;
  itemsAdministered: number;
  learningProfile: unknown;
}
export interface ActiveRunResponse {
  active: boolean;
  sessionId?: string;
  theta?: number;
  itemsAdministered?: number;
  lastServedItemId?: string | null;
  stop?: StopDecision;
}

export type StartRunResult = ({ ok: true } & StartRunResponse) | Fail;
export type RespondRunResult = ({ ok: true } & RespondRunResponse) | Fail;
export type FinalizeRunResult = ({ ok: true } & FinalizeRunResponse) | Fail;
export type ActiveRunResult = ({ ok: true } & ActiveRunResponse) | Fail;

/**
 * Map the persisted question set into the engine's candidate bank. Pass a
 * calibration override to send the service items at their refined θ.
 */
export function questionsToBank(
  questions: BaselineQuestion[],
  calibration?: Parameters<typeof questionToBaselineItem>[1],
): BaselineItem[] {
  return questions.map((q) => questionToBaselineItem(q, calibration));
}

export function adaptiveBaselineEndpoint(
  learnerId: string,
  action: "start" | "respond" | "finalize" | "active",
  baseUrl?: string,
): string {
  const resolved = baseUrl ?? serverEnv.ASSESSMENT_SVC_URL ?? "http://localhost:3071";
  const base = resolved.replace(/\/+$/, "");
  return `${base}/api/assessments/adaptive-baseline/${encodeURIComponent(learnerId)}/${action}`;
}

interface CallOptions {
  authToken: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/**
 * POST a JSON body to an adaptive-baseline endpoint, returning the parsed
 * data or a tagged failure. A 409 is surfaced as `response_rejected` with
 * the server's `reason` so the caller can distinguish an integrity
 * rejection from a transport error.
 */
async function callAdaptive<T>(
  learnerId: string,
  action: "start" | "respond" | "finalize",
  body: Record<string, unknown>,
  opts: CallOptions,
): Promise<({ ok: true; data: T }) | Fail> {
  const {
    authToken,
    timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    baseUrl,
  } = opts;
  const endpoint = adaptiveBaselineEndpoint(learnerId, action, baseUrl);
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted =
      typeof err === "object" && err !== null && "name" in err &&
      (err as { name?: string }).name === "AbortError";
    const reason: StreamFailureReason = aborted ? "timeout" : "network_error";
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ endpoint, reason, message }, "baseline-stream: fetch failed");
    return { ok: false, reason, message };
  } finally {
    clearTimeout(handle);
  }

  if (res.status === 409) {
    let rejection: string | undefined;
    try {
      rejection = ((await res.json()) as { reason?: string }).reason;
    } catch {
      /* ignore */
    }
    logger.warn({ endpoint, rejection }, "baseline-stream: response rejected");
    return {
      ok: false,
      reason: "response_rejected",
      status: 409,
      rejection,
      message: `assessment-svc rejected the response (${rejection ?? "unknown"})`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      reason: "non_2xx",
      status: res.status,
      message: `assessment-svc returned ${res.status}`,
    };
  }

  try {
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return {
      ok: false,
      reason: "invalid_json",
      message: err instanceof Error ? err.message : "invalid JSON",
    };
  }
}

export interface StartRunInput extends CallOptions {
  learnerId: string;
  bank: BaselineItem[];
  priorTheta?: number;
  readingDifficulty?: boolean;
}

export async function startAdaptiveBaselineRun(input: StartRunInput): Promise<StartRunResult> {
  const { learnerId, bank, priorTheta, readingDifficulty, ...opts } = input;
  const r = await callAdaptive<StartRunResponse>(
    learnerId,
    "start",
    { bank, priorTheta, readingDifficulty },
    opts,
  );
  return r.ok ? { ok: true, ...r.data } : r;
}

export interface RespondRunInput extends CallOptions {
  learnerId: string;
  sessionId: string;
  item: BaselineItem;
  response: ItemResponse;
  bank: BaselineItem[];
}

export async function respondAdaptiveBaselineRun(
  input: RespondRunInput,
): Promise<RespondRunResult> {
  const { learnerId, sessionId, item, response, bank, ...opts } = input;
  const r = await callAdaptive<RespondRunResponse>(
    learnerId,
    "respond",
    // Send both `itemId` (preferred) and `item` for service back-compat.
    { sessionId, itemId: item.id, item, response, bank },
    opts,
  );
  return r.ok ? { ok: true, ...r.data } : r;
}

export interface FinalizeRunInput extends CallOptions {
  learnerId: string;
  sessionId: string;
  bank: BaselineItem[];
}

export async function finalizeAdaptiveBaselineRun(
  input: FinalizeRunInput,
): Promise<FinalizeRunResult> {
  const { learnerId, sessionId, bank, ...opts } = input;
  const r = await callAdaptive<FinalizeRunResponse>(
    learnerId,
    "finalize",
    { sessionId, bank },
    opts,
  );
  return r.ok ? { ok: true, ...r.data } : r;
}

export interface ActiveRunInput extends CallOptions {
  learnerId: string;
}

/** Fetch the learner's in-progress session, if any (resume support). */
export async function activeAdaptiveBaselineRun(
  input: ActiveRunInput,
): Promise<ActiveRunResult> {
  const {
    authToken,
    timeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    baseUrl,
    learnerId,
  } = input;
  const endpoint = adaptiveBaselineEndpoint(learnerId, "active", baseUrl);
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: "GET",
      headers: { authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    });
  } catch (err) {
    const aborted =
      typeof err === "object" && err !== null && "name" in err &&
      (err as { name?: string }).name === "AbortError";
    const reason: StreamFailureReason = aborted ? "timeout" : "network_error";
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason, message };
  } finally {
    clearTimeout(handle);
  }

  if (!res.ok) {
    return { ok: false, reason: "non_2xx", status: res.status, message: `assessment-svc returned ${res.status}` };
  }
  try {
    return { ok: true, ...((await res.json()) as ActiveRunResponse) };
  } catch (err) {
    return { ok: false, reason: "invalid_json", message: err instanceof Error ? err.message : "invalid JSON" };
  }
}
