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

interface RawQuestion {
  id?: string;
  questionText?: string;
  options?: { value: string; label: string }[];
  correctAnswer?: string;
}

export type BaselineLoad =
  | { status: "ready"; questions: BaselineQuestion[] }
  | { status: "not_ready"; message: string };

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
    message?: string;
  };
  const raw = Array.isArray(json.questions) ? json.questions : [];
  const questions = raw.map(mapQuestion).filter((x): x is BaselineQuestion => x !== null);
  if (questions.length === 0) {
    return {
      status: "not_ready",
      message:
        json.message ??
        "Your baseline isn't ready yet. Ask your grown-up to finish the quick setup first.",
    };
  }
  return { status: "ready", questions };
}
