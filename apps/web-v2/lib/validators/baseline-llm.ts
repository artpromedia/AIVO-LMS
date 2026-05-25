/**
 * Sprint B1 — zod schema for the `/api/ai/generate-baseline` response.
 *
 * Mirrors `BaselineResponse` in
 * `services/ai-svc/src/ai_svc/routes/generate.py` and the per-question
 * validation it performs (id, subject, options with value+label,
 * correctAnswer ∈ options[].value, subject ∈ REQUIRED_SUBJECTS).
 *
 * The schema is intentionally a *re-validation* of the server payload:
 * the assessment-svc already drops malformed items, but defense-in-depth
 * here means the web-v2 fallback path always triggers on a truly broken
 * response rather than persisting half-baked questions.
 */
import { z } from "zod";

/**
 * Subjects allowed in an LLM-generated baseline. Kept in sync with
 * `REQUIRED_SUBJECTS` in `services/ai-svc/src/ai_svc/routes/generate.py`.
 */
export const BASELINE_LLM_REQUIRED_SUBJECTS = [
  "math",
  "ela",
  "science",
  "speech",
  "sel",
  "life_skills",
  "executive_function",
] as const;

export const baselineLlmSubjectSchema = z.enum(BASELINE_LLM_REQUIRED_SUBJECTS);
export type BaselineLlmSubject = z.infer<typeof baselineLlmSubjectSchema>;

export const baselineLlmOptionSchema = z.object({
  value: z.string().min(1).max(200),
  label: z.string().min(1).max(500),
});

export const baselineLlmQuestionSchema = z
  .object({
    id: z.string().min(1).max(200),
    subject: baselineLlmSubjectSchema,
    questionText: z.string().min(1).max(2000),
    options: z.array(baselineLlmOptionSchema).min(2).max(10),
    correctAnswer: z.string().min(1).max(200),
    // Optional metadata the ai-svc may attach (difficulty, explanation, etc.)
    difficulty: z.string().max(100).optional(),
    explanation: z.string().max(2000).optional(),
  })
  .superRefine((q, ctx) => {
    const valid = new Set(q.options.map((o) => o.value));
    if (!valid.has(q.correctAnswer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctAnswer"],
        message: `correctAnswer "${q.correctAnswer}" must equal one of the option values`,
      });
    }
  });

export const baselineLlmResponseSchema = z.object({
  questions: z.array(baselineLlmQuestionSchema),
  subjects: z.array(z.string()),
  model: z.string().min(1),
  prompt_tokens: z.number().int().min(0),
  completion_tokens: z.number().int().min(0),
});

export type BaselineLlmQuestion = z.infer<typeof baselineLlmQuestionSchema>;
export type BaselineLlmOption = z.infer<typeof baselineLlmOptionSchema>;
export type BaselineLlmResponse = z.infer<typeof baselineLlmResponseSchema>;

/**
 * Shape of the request body POSTed to `/api/ai/generate-baseline` on
 * the assessment-svc. Matches `BaselineRequest` in
 * `services/ai-svc/src/ai_svc/routes/generate.py`. All personalization
 * fields are optional — the prompt builder degrades gracefully.
 */
export const baselineLlmRequestSchema = z.object({
  parent_assessment: z.record(z.unknown()),
  functioning_level: z
    .enum(["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"])
    .default("STANDARD"),
  iep: z.record(z.unknown()).nullable().optional(),
  district: z.record(z.unknown()).nullable().optional(),
  interest_profile: z.record(z.unknown()).nullable().optional(),
  caregiver_perspectives: z.array(z.unknown()).nullable().optional(),
  teacher_assessment: z.record(z.unknown()).nullable().optional(),
});

export type BaselineLlmRequest = z.infer<typeof baselineLlmRequestSchema>;

/** Minimum questions per LLM response before the caller falls back to
 *  the deterministic BANK. Mirrors the ai-svc 502 threshold (14). */
export const MIN_BASELINE_LLM_QUESTIONS = 14;
