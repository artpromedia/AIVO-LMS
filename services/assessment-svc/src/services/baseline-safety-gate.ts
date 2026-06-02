/**
 * Sprint 4 — orchestrates the safety gate that sits between
 * ai-svc's generated baseline questions and the parent UI.
 *
 * Pipeline (best-effort, fail-open):
 *
 *   1. Run @aivo/responsible-ai-svc /evaluate on every AI question.
 *   2. Partition into (allowed, blocked) by `recommendedAction`.
 *   3. For every blocked slot, draw a replacement from the Sprint 3
 *      fallback bank for the same subject (skipping ids that are
 *      already in the response so we don't ship duplicates).
 *   4. Persist one `baseline_item_audits` row per evaluated item,
 *      tagging `shipped` = "yes" | "no". Write failures are swallowed
 *      so an audit-table outage cannot break the baseline.
 *
 * The route layer (`learner-baseline.ts`) calls
 * `applySafetyGate(...)` exactly once per AI response. There is no
 * regenerate-loop on the assessment-svc side — the LLM repair retry
 * happens inside ai-svc (Sprint 2). Here we simply swap blocked items
 * with curated bank items, which is faster (no extra LLM call) and
 * guaranteed-safe (the bank is pre-vetted).
 */
import {
  pickFallbackBaseline,
  type BaselineFallbackQuestion,
  type BaselineFallbackSubject,
  BASELINE_FALLBACK_SUBJECTS,
} from "@aivo/item-bank";
import {
  evaluateBaselineBatch,
  responsibleAiEnabled,
  type ResponsibleAiVerdict,
} from "./responsible-ai-client.js";

export interface BaselineQuestionLike {
  id?: string;
  subject?: string;
  questionText?: string;
  options?: unknown;
  correctAnswer?: string;
  [k: string]: unknown;
}

export interface ApplySafetyGateInput {
  learnerId: string;
  questions: BaselineQuestionLike[];
  /** Used for grade-aware fallback replacement selection. */
  gradeLevel?: string | null;
  /** Forwarded to responsible-ai-svc for profile-adherence checks. */
  functioningLevel?: string | null;
  accommodations?: string[];
  /** "warn" leaves blocked items in place but still audits; "block"
   *  swaps them with fallback items. Default "block". */
  policyMode?: "warn" | "block";
}

export interface BaselineAuditRecord {
  questionId: string;
  subject: string;
  source: "ai" | "fallback";
  recommendedAction: ResponsibleAiVerdict["recommendedAction"] | "allow";
  severity: ResponsibleAiVerdict["severity"] | "none";
  shipped: "yes" | "no";
  violationCodes: string[];
  violationMessages: string[];
}

export interface ApplySafetyGateResult {
  /** Final questions to ship to the client, in original subject order. */
  questions: BaselineQuestionLike[];
  /** Compact audit per evaluated item — caller persists via `persistAudits`. */
  audits: BaselineAuditRecord[];
  /** True when at least one AI item was replaced with a fallback. */
  hadReplacements: boolean;
  /** True when responsible-AI was disabled / unreachable / silent. */
  evaluatorSilent: boolean;
}

function isKnownSubject(s: string | undefined): s is BaselineFallbackSubject {
  return !!s && (BASELINE_FALLBACK_SUBJECTS as readonly string[]).includes(s);
}

/**
 * Best-effort summariser for the responsible-AI `inputSummary` field.
 * Trimmed to 200 chars so we don't blow the evaluator request size on
 * stems that happen to be unusually long.
 */
function summariseQuestion(q: BaselineQuestionLike): string {
  const stem = typeof q.questionText === "string" ? q.questionText : "";
  const subj = typeof q.subject === "string" ? q.subject : "?";
  return `${subj}: ${stem}`.slice(0, 200);
}

export async function applySafetyGate(input: ApplySafetyGateInput): Promise<ApplySafetyGateResult> {
  const {
    learnerId,
    questions,
    gradeLevel,
    functioningLevel,
    accommodations,
    policyMode = "block",
  } = input;

  if (!questions.length) {
    return { questions, audits: [], hadReplacements: false, evaluatorSilent: true };
  }

  // Evaluator off / unreachable → ship as-is, log nothing.
  if (!responsibleAiEnabled()) {
    return { questions, audits: [], hadReplacements: false, evaluatorSilent: true };
  }

  const verdicts = await evaluateBaselineBatch(questions as Record<string, unknown>[], {
    learnerId,
    inputSummary: "baseline-batch",
    learnerProfileSummary: {
      functioningLevel: functioningLevel ?? undefined,
      accommodations: accommodations ?? [],
    },
    policyMode,
  });

  // Did every verdict come back null? That means the evaluator is
  // disabled or unreachable across the batch — treat as silent: ship
  // every AI item as-is and skip auditing (there is no signal to
  // record). Sprint 4 contract: silent evaluator MUST NOT generate
  // noise audit rows that would dilute the block-rate dashboard.
  const evaluatorSilent = verdicts.every((v) => v === null);
  if (evaluatorSilent) {
    return { questions, audits: [], hadReplacements: false, evaluatorSilent: true };
  }

  // Build a pool of fallback questions per subject; only generated on
  // demand to avoid the cost when nothing was blocked. The pool is
  // keyed by learnerId so retries are deterministic.
  let fallbackPool: BaselineFallbackQuestion[] | null = null;
  const fallbackBySubject = new Map<string, BaselineFallbackQuestion[]>();
  function ensurePool() {
    if (fallbackPool) return;
    fallbackPool = pickFallbackBaseline({
      learnerId,
      gradeBand: gradeLevel ?? null,
      countPerSubject: 6,
    }).questions;
    for (const fq of fallbackPool) {
      const arr = fallbackBySubject.get(fq.subject) ?? [];
      arr.push(fq);
      fallbackBySubject.set(fq.subject, arr);
    }
  }

  const seenIds = new Set<string>();
  for (const q of questions) {
    if (typeof q.id === "string") seenIds.add(q.id);
  }

  const out: BaselineQuestionLike[] = [];
  const audits: BaselineAuditRecord[] = [];
  let hadReplacements = false;

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const verdict = verdicts[i];
    const subj = typeof q.subject === "string" ? q.subject : "?";
    const qid = typeof q.id === "string" ? q.id : `idx-${i}`;

    // Allow when the evaluator didn't speak, allowed it, or only asked
    // for a non-block action (revise / escalate — logged, not swapped).
    const shouldBlock = policyMode === "block" && verdict?.recommendedAction === "block";

    if (!shouldBlock) {
      out.push(q);
      audits.push({
        questionId: qid,
        subject: subj,
        source: "ai",
        recommendedAction: verdict?.recommendedAction ?? "allow",
        severity: verdict?.severity ?? "none",
        shipped: "yes",
        violationCodes: verdict?.violations?.map((v) => v.code) ?? [],
        violationMessages: verdict?.violations?.map((v) => v.message) ?? [],
      });
      continue;
    }

    // Record the rejected AI item.
    audits.push({
      questionId: qid,
      subject: subj,
      source: "ai",
      recommendedAction: verdict.recommendedAction,
      severity: verdict.severity,
      shipped: "no",
      violationCodes: verdict.violations.map((v) => v.code),
      violationMessages: verdict.violations.map((v) => v.message),
    });

    // Replace with a fallback item from the same subject. Bank items
    // are pre-vetted so we don't re-evaluate them here.
    if (!isKnownSubject(subj)) {
      // Unknown subject — drop the item rather than guess a replacement.
      continue;
    }
    ensurePool();
    const candidates = fallbackBySubject.get(subj) ?? [];
    const replacement = candidates.find((c) => !seenIds.has(c.id));
    if (!replacement) {
      // Bank exhausted for this subject; drop rather than duplicate.
      continue;
    }
    seenIds.add(replacement.id);
    out.push(replacement as unknown as BaselineQuestionLike);
    hadReplacements = true;
    audits.push({
      questionId: replacement.id,
      subject: replacement.subject,
      source: "fallback",
      recommendedAction: "allow",
      severity: "none",
      shipped: "yes",
      violationCodes: [],
      violationMessages: [],
    });
  }

  return { questions: out, audits, hadReplacements, evaluatorSilent };
}

export interface PersistAuditsInput {
  db: any;
  tenantId?: string | null;
  learnerId: string;
  audits: BaselineAuditRecord[];
  /** Free-form metadata captured once per batch (model, attempt id, etc.). */
  batchMetadata?: Record<string, unknown>;
  log?: { warn: (obj: Record<string, unknown>, msg: string) => void };
}

/**
 * Best-effort batch insert into `baseline_item_audits`. Any error is
 * caught and logged — persistence MUST NOT block the baseline response.
 */
export async function persistAudits(input: PersistAuditsInput): Promise<void> {
  const { db, tenantId, learnerId, audits, batchMetadata, log } = input;
  if (!db || !audits?.length) return;
  try {
    const { baselineItemAudits } = await import("@aivo/db");
    const rows = audits.map((a) => ({
      tenantId: tenantId ?? null,
      learnerId,
      questionId: a.questionId,
      subject: a.subject,
      source: a.source,
      recommendedAction: a.recommendedAction,
      severity: a.severity,
      shipped: a.shipped,
      violations: a.violationCodes.map((c, idx) => ({
        code: c,
        message: a.violationMessages[idx],
      })),
      metadata: batchMetadata ?? {},
    }));
    await db.insert(baselineItemAudits).values(rows);
  } catch (err: any) {
    log?.warn(
      { learnerId, count: audits.length, err: err?.message },
      "[baseline] audit persistence failed (non-fatal)",
    );
  }
}
