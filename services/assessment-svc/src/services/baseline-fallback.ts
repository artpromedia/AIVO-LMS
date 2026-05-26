/**
 * Sprint 3 — baseline fallback service.
 *
 * Wraps the curated baseline bank from `@aivo/item-bank` and translates
 * a learner profile into a 7-subject × 6-item payload that mirrors the
 * shape the ai-svc /api/ai/generate-baseline endpoint returns. Used
 * when the AI service fails (timeout, 5xx, or schema-validation
 * salvage path that still yields too few items) so the parent UI sees
 * a curated baseline instead of a 502.
 *
 * Graceful degradation, not a feature swap: every fallback response is
 * tagged `source: "fallback"` so the UI can surface a "Using curated
 * questions while we generate personalized ones" notice and so ops
 * can dashboard the AI-failure rate.
 */
import {
  pickFallbackBaseline,
  type BaselineFallbackQuestion,
  type BaselineFallbackSubject,
} from "@aivo/item-bank";

/** Mirrors the AI-svc SUBJECTS constant so the response shape matches. */
const SUBJECTS_RESPONSE = [
  { key: "math", label: "Math", emoji: "🔢", color: "#7C3AED" },
  { key: "ela", label: "Reading", emoji: "📖", color: "#10B981" },
  { key: "science", label: "Science", emoji: "🔬", color: "#F59E0B" },
  { key: "speech", label: "Speech", emoji: "🗣️", color: "#EC4899" },
  { key: "sel", label: "SEL", emoji: "💛", color: "#F43F5E" },
  { key: "life_skills", label: "Life Skills", emoji: "🏠", color: "#14B8A6" },
  { key: "executive_function", label: "Executive Function", emoji: "🧠", color: "#6366F1" },
] as const;

/**
 * Coerce noisy grade strings (e.g. "3rd", "Kindergarten", "PreK") into
 * the short tokens (`"K"`, `"1"`, …, `"12"`) the fallback bank's
 * `gradeBandFromSkillId` heuristic also produces. Returns `null` when
 * the input cannot be mapped — the caller still gets a fallback, just
 * grade-agnostic.
 */
export function normaliseGradeBand(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === "pk" || s.startsWith("pre")) return "PK";
  if (s === "k" || s.startsWith("kinder")) return "K";
  const m = s.match(/(\d{1,2})/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return String(n);
  }
  const words: Record<string, string> = {
    first: "1", second: "2", third: "3", fourth: "4", fifth: "5",
    sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
    eleventh: "11", twelfth: "12",
  };
  for (const [word, n] of Object.entries(words)) {
    if (s.includes(word)) return n;
  }
  return null;
}

export type BaselineFallbackReason =
  | "ai_unreachable"
  | "ai_non_2xx"
  | "ai_invalid_json"
  | "ai_too_few_questions"
  | "ai_disabled";

export interface BuildBaselineFallbackInput {
  learnerId: string;
  gradeLevel?: string | null;
  functioningLevel?: string | null;
  reason: BaselineFallbackReason;
}

export interface BaselineFallbackResponse {
  generated: true;
  learnerId: string;
  functioningLevel: string | null;
  source: "fallback";
  /** Why the AI service didn't serve this baseline — surfaced for ops. */
  fallbackReason: BaselineFallbackReason;
  questions: BaselineFallbackQuestion[];
  subjects: typeof SUBJECTS_RESPONSE;
  /** No real model — keep the field present so callers re-validating the
   *  ai-svc shape don't trip on it. */
  model: "fallback-bank";
}

/**
 * Build the fallback baseline payload. Pure — does not touch the DB or
 * any network and is therefore safe to call from within a route's
 * error path.
 */
export function buildBaselineFallback(
  input: BuildBaselineFallbackInput,
): BaselineFallbackResponse {
  const gradeBand = normaliseGradeBand(input.gradeLevel);
  const picked = pickFallbackBaseline({
    learnerId: input.learnerId,
    gradeBand,
    countPerSubject: 6,
  });
  return {
    generated: true,
    learnerId: input.learnerId,
    functioningLevel: input.functioningLevel ?? null,
    source: "fallback",
    fallbackReason: input.reason,
    questions: picked.questions,
    subjects: SUBJECTS_RESPONSE,
    model: "fallback-bank",
  };
}

/** Re-export the subject slug type for route-level callers. */
export type { BaselineFallbackSubject };
