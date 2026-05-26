/**
 * Sprint 14 — Crisis / self-harm detector + escalator.
 *
 * Pipeline:
 *   1. Keyword + regex bank (deterministic, fast).
 *   2. Optional classifier (pluggable; default = expanded keyword bank).
 *   3. On positive: trigger downstream escalation — PagerDuty page,
 *      parent ↔ teacher thread message via comms-svc, audit-svc record.
 *
 * Escalation side-effects fire only when the verdict is 'block' AND the
 * caller explicitly invokes `escalateCrisis(...)`. The detector itself
 * stays pure so unit tests do not page on-call.
 *
 * The comms-svc thread call depends on Sprint 13 (POST
 * /api/comms/threads/:id/messages). Until S13 merges, the call is wired
 * against the documented interface and tagged with TODO(sprint-13-merge).
 */
import type {
  CrisisCategory,
  DetectorContext,
  DetectorEvidence,
  DetectorResult,
} from "./types.js";

interface CrisisPattern {
  code: string;
  category: CrisisCategory;
  pattern: RegExp;
  message: string;
  confidence: number;
}

const PATTERNS: CrisisPattern[] = [
  // self-harm / suicidal ideation -------------------------------------------
  {
    code: "crisis.self_harm.explicit",
    category: "self_harm",
    pattern: /\b(?:kill|hurt|cut|harm)\s+(?:myself|me)\b/i,
    message: "Explicit self-harm statement",
    confidence: 1.0,
  },
  {
    code: "crisis.suicidal_ideation",
    category: "suicidal_ideation",
    pattern: /\bi\s+(?:want|wanna|wish)\s+to\s+(?:die|end\s+it(?:\s+all)?)\b/i,
    message: "Suicidal ideation",
    confidence: 1.0,
  },
  {
    code: "crisis.suicidal_ideation",
    category: "suicidal_ideation",
    pattern: /\bi\s+don'?t\s+want\s+to\s+(?:be\s+alive|live)\b/i,
    message: "Suicidal ideation",
    confidence: 1.0,
  },
  {
    code: "crisis.suicidal_ideation",
    category: "suicidal_ideation",
    pattern: /\bsuicid(?:e|al)\b/i,
    message: "Suicide keyword",
    confidence: 0.95,
  },
  {
    code: "crisis.self_harm.method",
    category: "self_harm",
    pattern: /\bhow\s+(?:can|do)\s+i\s+(?:hurt|kill)\s+myself\b/i,
    message: "Self-harm method-seeking",
    confidence: 1.0,
  },
  {
    code: "crisis.self_harm.paraphrase",
    category: "self_harm",
    pattern: /\b(?:want\s+to\s+disappear\s+forever|stop\s+existing|no\s+point\s+in\s+living|nothing\s+to\s+live\s+for)\b/i,
    message: "Self-harm paraphrase",
    confidence: 0.9,
  },

  // Abuse disclosure ---------------------------------------------------------
  {
    code: "crisis.abuse_disclosure",
    category: "abuse_disclosure",
    pattern: /\b(?:dad|mom|mum|uncle|aunt|stepdad|stepmom|teacher|brother|sister)\s+(?:hits|hurts|beats|touches)\s+me\b/i,
    message: "Abuse disclosure",
    confidence: 1.0,
  },
  {
    code: "crisis.abuse_disclosure",
    category: "abuse_disclosure",
    pattern: /\b(?:an?\s+)?adult\s+touched\s+me\b/i,
    message: "Abuse disclosure",
    confidence: 1.0,
  },
  {
    code: "crisis.abuse_disclosure",
    category: "abuse_disclosure",
    pattern: /\bi'?m\s+(?:scared|afraid)\s+to\s+go\s+home\b/i,
    message: "Possible abuse disclosure",
    confidence: 0.85,
  },

  // Violence to others -------------------------------------------------------
  {
    code: "crisis.violence_to_others",
    category: "violence_to_others",
    pattern: /\b(?:kill|shoot|stab)\s+(?:him|her|them|everyone|my\s+(?:teacher|classmates))\b/i,
    message: "Threat of violence toward others",
    confidence: 1.0,
  },
  {
    code: "crisis.violence_to_others",
    category: "violence_to_others",
    pattern: /\bblow\s+up\s+(?:the\s+)?(?:school|classroom|house)\b/i,
    message: "Threat of violence toward others",
    confidence: 1.0,
  },
];

export type CrisisClassifier = (
  text: string,
  context: DetectorContext,
) => Promise<{ category: CrisisCategory; confidence: number } | null>;

const _defaultClassifier: CrisisClassifier = async (text) => {
  const lower = text.toLowerCase();
  if (lower.includes("hopeless") || lower.includes("worthless")) {
    return { category: "self_harm", confidence: 0.6 };
  }
  return null;
};

let _classifier: CrisisClassifier = _defaultClassifier;

export function setCrisisClassifier(fn: CrisisClassifier): void {
  _classifier = fn;
}

export function resetCrisisClassifier(): void {
  _classifier = _defaultClassifier;
}

export async function detectCrisis(
  context: DetectorContext,
): Promise<DetectorResult> {
  const started = Date.now();
  const text = context.text ?? "";
  const evidence: DetectorEvidence[] = [];
  let topCategory: CrisisCategory | null = null;
  let topConfidence = 0;
  try {
    if (text.length === 0) {
      return {
        detector: "crisis",
        verdict: "allow",
        evidence: [],
        durationMs: Date.now() - started,
        errored: false,
      };
    }
    for (const p of PATTERNS) {
      if (p.pattern.test(text)) {
        evidence.push({
          code: p.code,
          message: p.message,
          confidence: p.confidence,
        });
        if (p.confidence > topConfidence) {
          topConfidence = p.confidence;
          topCategory = p.category;
        }
      }
    }
    try {
      const cls = await _classifier(text, context);
      if (cls && cls.confidence > 0) {
        evidence.push({
          code: `crisis.classifier.${cls.category}`,
          message: "Crisis classifier signal",
          confidence: cls.confidence,
        });
        if (cls.confidence > topConfidence) {
          topConfidence = cls.confidence;
          topCategory = cls.category;
        }
      }
    } catch (err) {
      return {
        detector: "crisis",
        verdict: "review",
        evidence,
        durationMs: Date.now() - started,
        errored: true,
        error: (err as Error).message,
      };
    }
    const verdict =
      topConfidence >= 0.85
        ? "block"
        : evidence.length > 0
          ? "review"
          : "allow";
    return {
      detector: "crisis",
      verdict,
      evidence,
      durationMs: Date.now() - started,
      errored: false,
      meta: topCategory
        ? { category: topCategory, confidence: topConfidence }
        : undefined,
    };
  } catch (err) {
    return {
      detector: "crisis",
      verdict: "review",
      evidence,
      durationMs: Date.now() - started,
      errored: true,
      error: (err as Error).message,
    };
  }
}

// ---------------------------------------------------------------------------
// Escalation side-effects
// ---------------------------------------------------------------------------

export interface CrisisEscalationContext {
  correlationId: string;
  learnerId: string;
  tenantId?: string;
  category: CrisisCategory;
  /** Optional parent-teacher thread id; resolved by family-svc upstream. */
  threadId?: string;
  /** Wall-clock for SLO bookkeeping. */
  detectedAt: string;
}

export interface CrisisEscalationResult {
  paged: boolean;
  threadPosted: boolean;
  audited: boolean;
  errors: string[];
}

const PAGERDUTY_INTEGRATION_KEY = () =>
  process.env.PAGERDUTY_INTEGRATION_KEY ?? "";
const PAGERDUTY_EVENTS_URL =
  process.env.PAGERDUTY_EVENTS_URL ?? "https://events.pagerduty.com/v2/enqueue";
const COMMS_SVC_URL = () =>
  (process.env.COMMS_SVC_URL ?? "http://localhost:3010").replace(/\/+$/, "");
const AUDIT_SVC_URL = () =>
  (process.env.AUDIT_SVC_URL ?? "http://localhost:3050").replace(/\/+$/, "");
const INTERNAL_SERVICE_TOKEN = () =>
  process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token";

const ESCALATION_TIMEOUT_MS = Number(
  process.env.CRISIS_ESCALATION_TIMEOUT_MS ?? 4000,
);

async function pagePagerDuty(
  ctx: CrisisEscalationContext,
): Promise<{ ok: boolean; error?: string }> {
  const key = PAGERDUTY_INTEGRATION_KEY();
  if (!key) {
    return { ok: false, error: "PAGERDUTY_INTEGRATION_KEY not configured" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESCALATION_TIMEOUT_MS);
  try {
    const res = await fetch(PAGERDUTY_EVENTS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        routing_key: key,
        event_action: "trigger",
        dedup_key: `aivo-crisis:${ctx.correlationId}`,
        payload: {
          summary: `AIVO crisis signal (${ctx.category}) — learner ${ctx.learnerId}`,
          severity: "critical",
          source: "responsible-ai-svc",
          component: "crisis-detector",
          group: "ai-safety",
          class: ctx.category,
          custom_details: {
            tenant_id: ctx.tenantId ?? null,
            learner_id: ctx.learnerId,
            correlation_id: ctx.correlationId,
            detected_at: ctx.detectedAt,
            service_id: process.env.PAGERDUTY_AI_SAFETY_SERVICE_ID ?? null,
          },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `pagerduty status ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

async function postToParentTeacherThread(
  ctx: CrisisEscalationContext,
): Promise<{ ok: boolean; error?: string }> {
  if (!ctx.threadId) {
    return { ok: false, error: "no threadId resolved" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESCALATION_TIMEOUT_MS);
  try {
    // TODO(sprint-13-merge): once comms-svc lands the typed thread client,
    // swap this fetch for the shared client so we pick up retry + circuit
    // breaker policy without re-implementing them here. Interface is
    // documented in docs/comms/threads-api.md.
    const res = await fetch(
      `${COMMS_SVC_URL()}/api/comms/threads/${encodeURIComponent(ctx.threadId)}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-service-token": INTERNAL_SERVICE_TOKEN(),
        },
        body: JSON.stringify({
          kind: "system",
          authorRole: "service",
          authorId: "responsible-ai-svc",
          subject: "Safety alert: please reach out to your learner",
          body:
            "Our AI safety system noticed a signal that may indicate your child " +
            "needs immediate support. A counselor is being paged. Please " +
            "connect with your child and reply here when you have.",
          metadata: {
            correlation_id: ctx.correlationId,
            category: ctx.category,
            detected_at: ctx.detectedAt,
          },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      return { ok: false, error: `comms-svc status ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

async function recordAudit(
  ctx: CrisisEscalationContext,
): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESCALATION_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUDIT_SVC_URL()}/api/audit-events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": INTERNAL_SERVICE_TOKEN(),
      },
      body: JSON.stringify({
        action: "RESPONSIBLE_AI_CRISIS_ESCALATED",
        resourceType: "crisis_escalation",
        resourceId: ctx.correlationId,
        tenantId: ctx.tenantId ?? null,
        actorUserId: null,
        actorRole: "service",
        details: {
          learnerId: ctx.learnerId,
          category: ctx.category,
          detectedAt: ctx.detectedAt,
          threadId: ctx.threadId ?? null,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `audit-svc status ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

export async function escalateCrisis(
  ctx: CrisisEscalationContext,
): Promise<CrisisEscalationResult> {
  // Fan out in parallel — each leg is independently best-effort.
  const [pdRes, threadRes, auditRes] = await Promise.all([
    pagePagerDuty(ctx),
    postToParentTeacherThread(ctx),
    recordAudit(ctx),
  ]);
  const errors: string[] = [];
  if (!pdRes.ok && pdRes.error) errors.push(`pagerduty: ${pdRes.error}`);
  if (!threadRes.ok && threadRes.error)
    errors.push(`comms-svc: ${threadRes.error}`);
  if (!auditRes.ok && auditRes.error)
    errors.push(`audit-svc: ${auditRes.error}`);
  return {
    paged: pdRes.ok,
    threadPosted: threadRes.ok,
    audited: auditRes.ok,
    errors,
  };
}
