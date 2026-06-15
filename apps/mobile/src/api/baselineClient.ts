/**
 * Mobile baseline question source — replaces the screen's hardcoded SAMPLE
 * array with the real per-learner baseline from assessment-svc.
 *
 * `GET /api/assessments/learner/baseline/:learnerId` returns either an
 * AI-generated set or, on AI failure, a curated fallback bank (the server
 * never 502s the learner), so the client never needs its own hardcoded
 * questions. When the parent hasn't completed the intake yet the server
 * returns `questions: null`, which we surface as "not ready".
 */
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";

export interface BaselineQuestion {
  id: string;
  q: string;
  options: string[];
  correctAnswer: string | null;
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

interface RawQuestion {
  id?: string;
  questionText?: string;
  options?: { value: string; label: string }[];
  correctAnswer?: string;
}

interface RawSubject {
  key?: string;
  label?: string;
  emoji?: string;
  color?: string;
}

export type BaselineLoad =
  | { status: "ready"; questions: BaselineQuestion[]; subjects: BaselineSubject[] }
  | { status: "not_ready"; message: string; subjects: BaselineSubject[] };

function mapQuestion(raw: RawQuestion, idx: number): BaselineQuestion | null {
  const q = (raw.questionText ?? "").trim();
  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => (o?.label ?? o?.value ?? "").trim()).filter(Boolean)
    : [];
  if (!q || options.length === 0) return null;
  return {
    id: raw.id ?? `q_${idx}`,
    q,
    options,
    correctAnswer: raw.correctAnswer ?? null,
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
  return { status: "ready", questions, subjects };
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
