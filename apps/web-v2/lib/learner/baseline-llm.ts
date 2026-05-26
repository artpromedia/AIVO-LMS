/**
 * Sprint B1 — server-side fetcher that POSTs the parent assessment
 * (and optional personalization payload) to the assessment-svc
 * `/api/ai/generate-baseline` proxy, validates the response with the
 * zod schema in `lib/validators/baseline-llm.ts`, and returns a tagged
 * result the Sprint B2 wiring in `createBaseline` can branch on.
 *
 * Sprint B1 deliberately only exposes the fetch + validation surface.
 * No call site is rewired until Sprint B2 lands behind a feature flag.
 *
 * Parity reference:
 *   - `services/assessment-svc/src/routes/learner-baseline.ts`
 *     `POST /api/ai/generate-baseline`
 *   - `services/ai-svc/src/ai_svc/routes/generate.py`
 *     `BaselineRequest` / `BaselineResponse`
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { newId } from "@/lib/db/store";
import type {
  BaselineDifficulty,
  BaselineQuestion,
  Skill,
  Subject,
} from "@/lib/db/types";
import {
  baselineLlmRequestSchema,
  baselineLlmResponseSchema,
  MIN_BASELINE_LLM_QUESTIONS,
  type BaselineLlmRequest,
  type BaselineLlmResponse,
  type BaselineLlmQuestion,
  type BaselineLlmSubject,
} from "@/lib/validators/baseline-llm";

/**
 * Default request timeout for the LLM baseline call. The ai-svc
 * upstream typically completes in 6–20 s; we set the budget high
 * enough to avoid clipping a healthy response and rely on the
 * fallback path in B2 to handle a real timeout.
 */
export const DEFAULT_BASELINE_LLM_TIMEOUT_MS = 30_000;

export type BaselineLlmFailureReason =
  | "network_error"
  | "timeout"
  | "non_2xx"
  | "invalid_json"
  | "schema_validation_failed"
  | "too_few_questions";

export type BaselineLlmResult =
  | { ok: true; response: BaselineLlmResponse }
  | {
      ok: false;
      reason: BaselineLlmFailureReason;
      status?: number;
      message: string;
    };

export type GenerateBaselineViaLlmInput = BaselineLlmRequest & {
  /** Override the default request timeout. */
  timeoutMs?: number;
  /** Override the default fetch (test seam — defaults to global fetch). */
  fetchImpl?: typeof fetch;
  /** Override the assessment-svc base URL (test seam). */
  baseUrl?: string;
};

/**
 * Build the absolute URL of the assessment-svc generate-baseline
 * proxy. Exported so tests can assert routing.
 */
export function baselineLlmEndpoint(baseUrl?: string): string {
  // Trim a trailing slash so concatenation is unambiguous regardless of
  // how the env var is configured ("https://x/" vs "https://x").
  const resolved = baseUrl ?? serverEnv.ASSESSMENT_SVC_URL ?? "http://localhost:3071";
  const base = resolved.replace(/\/+$/, "");
  return `${base}/api/ai/generate-baseline`;
}

/**
 * Call the assessment-svc to generate an LLM-backed baseline. Returns
 * a tagged success/failure object so the caller can route to the
 * deterministic BANK fallback (Sprint B2) on any failure mode without
 * special-casing exception types.
 */
export async function generateBaselineQuestionsViaLLM(
  input: GenerateBaselineViaLlmInput,
): Promise<BaselineLlmResult> {
  const parsedRequest = baselineLlmRequestSchema.safeParse(input);
  if (!parsedRequest.success) {
    return {
      ok: false,
      reason: "schema_validation_failed",
      message: `request payload failed validation: ${parsedRequest.error.message}`,
    };
  }

  const {
    timeoutMs = DEFAULT_BASELINE_LLM_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    baseUrl,
    ...body
  } = input;
  const endpoint = baselineLlmEndpoint(baseUrl);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN
          ? {
              "x-internal-service": "web-v2",
              "x-service-token": serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN,
            }
          : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const aborted =
      (err instanceof Error && err.name === "AbortError") ||
      (typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "AbortError");
    const reason: BaselineLlmFailureReason = aborted ? "timeout" : "network_error";
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      { endpoint, reason, message },
      "baseline-llm: fetch failed",
    );
    return { ok: false, reason, message };
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn(
      { endpoint, status: res.status, body: text.slice(0, 500) },
      "baseline-llm: non-2xx from assessment-svc",
    );
    return {
      ok: false,
      reason: "non_2xx",
      status: res.status,
      message: `assessment-svc returned ${res.status}`,
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (err) {
    return {
      ok: false,
      reason: "invalid_json",
      message: err instanceof Error ? err.message : "invalid JSON",
    };
  }

  const parsedResponse = baselineLlmResponseSchema.safeParse(raw);
  if (!parsedResponse.success) {
    logger.warn(
      { endpoint, issues: parsedResponse.error.flatten() },
      "baseline-llm: response failed schema validation",
    );
    return {
      ok: false,
      reason: "schema_validation_failed",
      message: parsedResponse.error.message,
    };
  }

  if (parsedResponse.data.questions.length < MIN_BASELINE_LLM_QUESTIONS) {
    return {
      ok: false,
      reason: "too_few_questions",
      message: `expected ≥${MIN_BASELINE_LLM_QUESTIONS} questions, got ${parsedResponse.data.questions.length}`,
    };
  }

  return { ok: true, response: parsedResponse.data };
}

/**
 * Sprint B2 — map an LLM `subject` (from ai-svc `REQUIRED_SUBJECTS`) to
 * the web-v2 store subject slug used in the seed. ai-svc emits taxonomy
 * names ("ela", "sel", "executive_function"); the local store keys are
 * the LEARNER_SUBJECTS slugs ("reading", "social", "executive-function").
 */
export const LLM_TO_WEB_V2_SUBJECT_SLUG: Record<BaselineLlmSubject, string> = {
  math: "math",
  ela: "reading",
  science: "science",
  speech: "speech",
  sel: "social",
  life_skills: "life-skills",
  executive_function: "executive-function",
};

export type MapLlmQuestionsInput = {
  baselineId: string;
  llmResponse: BaselineLlmResponse;
  subjects: Subject[];
  skills: Skill[];
  accommodationTags: string[];
};

/**
 * Convert the LLM response into the web-v2 `BaselineQuestion` shape so
 * the rest of the baseline pipeline (persistence, run UI, scoring)
 * stays unchanged. Questions whose subject doesn't map to a known
 * web-v2 subject — or whose subject has no skill seeded — are silently
 * dropped; callers should treat an empty return as "fall back to BANK"
 * (Sprint B2 does this in `createBaseline`).
 *
 * Difficulty: the ai-svc payload only carries a free-form `difficulty`
 * hint, so we map it onto the existing `BaselineDifficulty` enum and
 * default to "grade_level" when it can't be recognised.
 */
export function mapLlmQuestionsToBaselineQuestions(
  input: MapLlmQuestionsInput,
): BaselineQuestion[] {
  const { baselineId, llmResponse, subjects, skills, accommodationTags } = input;

  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  const firstSkillBySubjectId = new Map<string, Skill>();
  for (const sk of skills) {
    if (!firstSkillBySubjectId.has(sk.subjectId)) {
      firstSkillBySubjectId.set(sk.subjectId, sk);
    }
  }

  const out: BaselineQuestion[] = [];
  let order = 0;
  for (const q of llmResponse.questions) {
    const subjectSlug = LLM_TO_WEB_V2_SUBJECT_SLUG[q.subject];
    if (!subjectSlug) continue;
    const subject = subjectBySlug.get(subjectSlug);
    if (!subject) continue;
    const skill = firstSkillBySubjectId.get(subject.id);
    if (!skill) continue;

    order += 1;
    const choiceEmojis = q.options.map((o) => o.emoji ?? "");
    const hasAnyEmoji = choiceEmojis.some((e) => e.length > 0);
    out.push({
      id: newId("bq"),
      baselineId,
      subjectId: subject.id,
      skillId: skill.id,
      order,
      prompt: q.questionText,
      choices: q.options.map((o) => o.label),
      choiceEmojis: hasAnyEmoji ? choiceEmojis : undefined,
      sceneEmoji: q.sceneEmoji,
      imageUrl: q.imageUrl,
      imageAlt: q.imageAlt,
      expectedAnswer: labelForValue(q.options, q.correctAnswer),
      hint: q.explanation,
      readAloudText: q.questionText,
      difficulty: mapLlmDifficulty(q.difficulty),
      accommodationTags,
    });
  }
  return out;
}

function labelForValue(
  options: BaselineLlmQuestion["options"],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function mapLlmDifficulty(raw: string | undefined): BaselineDifficulty {
  if (!raw) return "grade_level";
  const v = raw.toLowerCase();
  if (v.includes("found") || v === "easy" || v.includes("intro")) {
    return "foundational";
  }
  if (v.includes("approach") || v.includes("emerging")) return "approaching";
  if (v.includes("stretch") || v === "hard" || v.includes("advanced")) {
    return "stretch";
  }
  return "grade_level";
}
