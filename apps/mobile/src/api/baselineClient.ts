/**
 * Mobile baseline question source — replaces the screen's hardcoded SAMPLE
 * array with the real per-learner baseline from assessment-svc.
 *
 * `GET /api/assessments/learner/baseline/:learnerId` returns either an
 * AI-generated set or, on AI failure, a curated fallback bank (the server
 * never 502s the learner), so the client never needs its own hardcoded
 * questions. When the parent hasn't completed the intake yet the server
 * returns `questions: null`, which we surface as "not ready".
 *
 * Each question arrives as
 *   { id, subject, questionText, options:[{label,value}], correctAnswer:"<value>", difficulty }
 * (see services/ai-svc baseline_generator). The runner feeds these into the
 * real `@aivo/adaptive-baseline` engine, so we preserve the engine-relevant
 * fields (`subject` → skill, numeric `difficulty` → θ band) and keep the
 * option `value`s so correctness is compared by value, never by display label.
 */
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";

/** One answer choice: `label` is what the learner sees, `value` is the scored id. */
export interface BaselineChoice {
  label: string;
  value: string;
}

export interface BaselineQuestion {
  id: string;
  q: string;
  options: BaselineChoice[];
  /** The scored option `value` (not the display label), or null when unknown. */
  correctAnswer: string | null;
  /** Subject/domain key (math, ela, …) — used as the engine skill + grouping. */
  subject: string;
  /** Authored difficulty tier as a number (1 = easy, 2 = moderate, 3 = hard). */
  difficulty: number;
}

/**
 * Subject the learner can pick at the baseline pre-flight. Served by
 * assessment-svc alongside the questions (`subjects: [...]` on both the AI and
 * curated-fallback paths) so the mobile picker renders the SAME canonical set
 * the backend chose for this learner — never a hardcoded client list.
 */
export interface BaselineSubject {
  key: string;
  label: string;
  emoji?: string;
  color?: string;
}

/** Functioning levels that gate choice count + audio-first presentation. */
export type FunctioningLevel =
  | "STANDARD"
  | "SUPPORTED"
  | "LOW_VERBAL"
  | "NON_VERBAL"
  | "PRE_SYMBOLIC";

const FUNCTIONING_LEVELS: readonly FunctioningLevel[] = [
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
];

/**
 * Max answer choices per functioning level. Source of truth:
 * `packages/learner-ui/src/tokens/fl-profiles.ts` (`maxChoices`). Inlined here
 * — not imported — because `@aivo/learner-ui` is web-coupled and is not a
 * mobile runtime dependency; keep the two in lock-step if the profile changes.
 */
export const FL_MAX_CHOICES: Record<FunctioningLevel, number> = {
  STANDARD: 5,
  SUPPORTED: 3,
  LOW_VERBAL: 2,
  NON_VERBAL: 2,
  PRE_SYMBOLIC: 2,
};

/** Audio-first presentation per functioning level (same source as above). */
export const FL_AUDIO_FIRST: Record<FunctioningLevel, boolean> = {
  STANDARD: false,
  SUPPORTED: false,
  LOW_VERBAL: true,
  NON_VERBAL: true,
  PRE_SYMBOLIC: true,
};

export function normalizeFunctioningLevel(raw: string | null | undefined): FunctioningLevel {
  const v = (raw ?? "STANDARD").toUpperCase();
  return (FUNCTIONING_LEVELS as readonly string[]).includes(v)
    ? (v as FunctioningLevel)
    : "STANDARD";
}

/**
 * θ calibration for the baseline's difficulty tiers. The assessment-svc bank
 * scores difficulty as a small integer (1 = easy, 2 = moderate, 3 = hard);
 * this maps each tier onto the engine's logit (`b`) scale — 0 ≈ on-grade for
 * an average learner, negative easier, positive harder — mirroring the spirit
 * of web's `THETA_BY_DIFFICULTY` (apps/web-v2/lib/learner/baseline-adaptive.ts)
 * on the numeric scale. Unknown tiers fall back to on-grade (0).
 */
const THETA_BY_TIER: Record<number, number> = { 1: -0.7, 2: 0, 3: 0.7 };

export function difficultyToTheta(tier: number): number {
  return THETA_BY_TIER[tier] ?? 0;
}

const TIER_FROM_STRING: Record<string, number> = {
  easy: 1,
  medium: 2,
  moderate: 2,
  hard: 3,
};

/**
 * Cap the visible choices to the functioning-level `maxChoices` while
 * guaranteeing the correct choice is never dropped (the runner has the scored
 * `value`, so it can keep the answer in view). The correct choice is appended
 * last when it would otherwise be cut, so capping never introduces a fixed
 * "the answer is always first" position cue.
 */
export function capChoices(
  options: BaselineChoice[],
  correctValue: string | null,
  max: number,
): BaselineChoice[] {
  if (options.length <= max) return options;
  const head = options.slice(0, max);
  if (correctValue == null || head.some((o) => o.value === correctValue)) return head;
  const correct = options.find((o) => o.value === correctValue);
  if (!correct) return head;
  return [...head.slice(0, Math.max(0, max - 1)), correct];
}

interface RawChoice {
  value?: string;
  label?: string;
}

interface RawQuestion {
  id?: string;
  subject?: string;
  questionText?: string;
  options?: RawChoice[];
  correctAnswer?: string;
  difficulty?: number | string;
}

interface RawSubject {
  key?: string;
  label?: string;
  emoji?: string;
  color?: string;
}

export type BaselineLoad =
  | {
      status: "ready";
      questions: BaselineQuestion[];
      subjects: BaselineSubject[];
      functioningLevel: FunctioningLevel;
    }
  | { status: "not_ready"; message: string; subjects: BaselineSubject[] };

function parseDifficulty(raw: number | string | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") return TIER_FROM_STRING[raw.trim().toLowerCase()] ?? 0;
  return 0;
}

function mapQuestion(raw: RawQuestion, idx: number): BaselineQuestion | null {
  const q = (raw.questionText ?? "").trim();
  const options: BaselineChoice[] = Array.isArray(raw.options)
    ? raw.options
        .map((o) => {
          const label = (o?.label ?? o?.value ?? "").trim();
          const value = (o?.value ?? o?.label ?? "").trim();
          return { label, value };
        })
        .filter((o) => o.label && o.value)
    : [];
  if (!q || options.length === 0) return null;
  return {
    id: raw.id ?? `q_${idx}`,
    q,
    options,
    correctAnswer: raw.correctAnswer ?? null,
    subject: (raw.subject ?? "general").trim() || "general",
    difficulty: parseDifficulty(raw.difficulty),
  };
}

function mapSubject(raw: RawSubject): BaselineSubject | null {
  const label = (raw.label ?? "").trim();
  const key = (raw.key ?? label).trim();
  if (!label || !key) return null;
  return { key, label, emoji: raw.emoji, color: raw.color };
}

function parseSubjects(raw: unknown): BaselineSubject[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(mapSubject).filter((s): s is BaselineSubject => s !== null);
}

/**
 * Fetch the learner's baseline questions. Throws on a network/transport
 * error so the screen can show a retry state; returns `not_ready` when the
 * baseline hasn't been generated yet.
 */
export async function fetchBaselineQuestions(learnerId: string): Promise<BaselineLoad> {
  const res = await apiFetch(API.ASSESSMENT, `/api/assessments/learner/baseline/${learnerId}`);
  if (!res.ok) {
    throw new Error(`baseline fetch failed: ${res.status}`);
  }
  const json = (await res.json().catch(() => ({}))) as {
    questions?: RawQuestion[] | null;
    subjects?: RawSubject[] | null;
    functioningLevel?: string | null;
    functioning_level?: string | null;
    message?: string;
  };
  const subjects = parseSubjects(json.subjects);
  const raw = Array.isArray(json.questions) ? json.questions : [];
  const questions = raw.map(mapQuestion).filter((x): x is BaselineQuestion => x !== null);
  if (questions.length === 0) {
    return {
      status: "not_ready",
      message:
        json.message ??
        "Your baseline isn't ready yet. Ask your grown-up to finish the quick setup first.",
      subjects,
    };
  }
  return {
    status: "ready",
    questions,
    subjects,
    functioningLevel: normalizeFunctioningLevel(json.functioningLevel ?? json.functioning_level),
  };
}

/**
 * Fetch just the canonical subject list for the baseline pre-flight picker.
 * Reuses {@link fetchBaselineQuestions} so the picker and the runner agree on
 * the learner's subjects. Returns `[]` (never throws) on transport failure so
 * the pre-flight screen can degrade gracefully instead of dead-ending.
 */
export async function fetchBaselineSubjects(learnerId: string): Promise<BaselineSubject[]> {
  try {
    const load = await fetchBaselineQuestions(learnerId);
    return load.subjects;
  } catch {
    return [];
  }
}

/** One domain bucket in a completion payload (mirrors the web/discovery shape). */
export interface BaselineChapterResult {
  domain: string;
  correct: number;
  total: number;
  difficulty: number;
  avgLatencyMs: number;
}

export interface BaselineCompletionPayload {
  chapterResults: BaselineChapterResult[];
  totalCorrect: number;
  totalAttempts: number;
  responseLatencies: number[];
  xpEarned?: number;
}

/**
 * Persist a finished baseline as a `discovery_adventure` attempt via
 * `POST /api/assessments/learner/discovery/:learnerId/complete`. The server
 * records correctness/latency silently for the parent handoff and learning
 * plan — the learner never sees a score.
 *
 * This is the mobile baseline BFF's recording path. The web runner persists
 * one attempt row per answer because it is stateless across page reloads and
 * replays history each load; the mobile runner holds the adaptive engine state
 * in memory across items, so it records the full per-item session here in one
 * call — the same responses, recorded through the same service.
 *
 * Returns `true` when the attempt persisted, `false` on any transport/HTTP
 * failure. Never throws: the runner shows the warm completion screen
 * regardless, so a flaky network can't trap a child mid-celebration.
 */
export async function completeBaseline(
  learnerId: string,
  payload: BaselineCompletionPayload,
): Promise<boolean> {
  try {
    const res = await apiFetch(
      API.ASSESSMENT,
      `/api/assessments/learner/discovery/${learnerId}/complete`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    return res.ok;
  } catch {
    return false;
  }
}
