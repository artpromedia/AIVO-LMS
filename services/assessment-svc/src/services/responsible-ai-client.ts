/**
 * Sprint 4 — TypeScript client for @aivo/responsible-ai-svc.
 *
 * Mirrors the python `services/ai-svc/.../responsible_ai_client.py`
 * pattern: best-effort, flag-gated, fail-open so a responsible-AI
 * outage cannot block the baseline pipeline. Returns the verdict
 * dictionary on success, `null` on any transport / 4xx / 5xx error or
 * when the feature flag is off.
 *
 * Used by `services/assessment-svc/src/routes/learner-baseline.ts` to
 * gate every generated baseline question against age-appropriateness,
 * prompt-injection, and profile-adherence policies BEFORE the items
 * are returned to the parent UI.
 */

const DEFAULT_URL = "http://localhost:3071";

function responsibleAiUrl(): string {
  return process.env.RESPONSIBLE_AI_SVC_URL ?? DEFAULT_URL;
}

export function responsibleAiEnabled(): boolean {
  const raw = (process.env.AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type ResponsibleAiAction = "allow" | "revise" | "block" | "escalate";
export type ResponsibleAiSeverity = "none" | "low" | "medium" | "high" | "critical";
export type ResponsibleAiPolicyMode = "warn" | "block";

export interface ResponsibleAiViolation {
  code: string;
  message: string;
  evidence?: string;
}

export interface ResponsibleAiVerdict {
  allowed: boolean;
  severity: ResponsibleAiSeverity;
  violations: ResponsibleAiViolation[];
  recommendedAction: ResponsibleAiAction;
}

export interface EvaluateBaselineItemInput {
  learnerId: string;
  /** The question itself — passed as `output` to the evaluator. */
  question: Record<string, unknown>;
  /** Short summary of the parent context used for profile-adherence. */
  inputSummary?: string;
  learnerProfileSummary?: {
    functioningLevel?: string;
    accommodations?: string[];
  };
  /** `"warn"` returns advisory output, `"block"` enforces hard stops. */
  policyMode?: ResponsibleAiPolicyMode;
  /** Fetch override for tests. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in ms. Default 2 s — evaluator is fast. */
  timeoutMs?: number;
}

/**
 * Evaluate one baseline item. Returns `null` when the flag is off, the
 * request times out, or the responsible-AI service returns a non-2xx
 * response — callers MUST treat `null` as "no opinion" and fall back
 * to allow.
 */
export async function evaluateBaselineItem(
  input: EvaluateBaselineItemInput,
): Promise<ResponsibleAiVerdict | null> {
  if (!responsibleAiEnabled()) return null;
  const {
    learnerId,
    question,
    inputSummary = "baseline question",
    learnerProfileSummary,
    policyMode = "block",
    fetchImpl = globalThis.fetch,
    timeoutMs = 2000,
  } = input;

  const url = `${responsibleAiUrl()}/api/responsible-ai/evaluate`;
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        learnerId,
        contextType: "baseline",
        inputSummary,
        output: question,
        learnerProfileSummary,
        policyMode,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ResponsibleAiVerdict;
    if (typeof data?.allowed !== "boolean") return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(handle);
  }
}

/**
 * Bulk-evaluate a batch of baseline questions. Runs all checks in
 * parallel for speed; a single slow evaluation cannot dominate the
 * batch budget because each call has its own timeout.
 */
export async function evaluateBaselineBatch(
  questions: Record<string, unknown>[],
  ctx: Omit<EvaluateBaselineItemInput, "question">,
): Promise<(ResponsibleAiVerdict | null)[]> {
  if (!responsibleAiEnabled()) return questions.map(() => null);
  return Promise.all(
    questions.map((q) => evaluateBaselineItem({ ...ctx, question: q })),
  );
}

/**
 * Partition a batch of (question, verdict) pairs into (allowed,
 * blocked). Verdicts of `null` ("evaluator unavailable") are treated
 * as allow so a responsible-AI outage cannot delete the entire
 * baseline. A verdict of `recommendedAction === "revise"` is also
 * allowed — the item passes through with the warning logged — because
 * the baseline doesn't have a revise loop yet (Sprint 4 ships
 * allow/block only; revise routes through ops review).
 */
export function partitionByVerdict<TQ extends Record<string, unknown>>(
  pairs: { question: TQ; verdict: ResponsibleAiVerdict | null }[],
): { allowed: TQ[]; blocked: { question: TQ; verdict: ResponsibleAiVerdict }[] } {
  const allowed: TQ[] = [];
  const blocked: { question: TQ; verdict: ResponsibleAiVerdict }[] = [];
  for (const { question, verdict } of pairs) {
    if (verdict && verdict.recommendedAction === "block") {
      blocked.push({ question, verdict });
    } else {
      allowed.push(question);
    }
  }
  return { allowed, blocked };
}
