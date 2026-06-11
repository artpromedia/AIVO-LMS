/**
 * Wave E (S10) — domain tool adapters for the tutor agent.
 *
 * Each adapter turns a model tool call into a REAL capability:
 *
 *   read_math_work          → math-recognizer-svc /api/math-recognizer/recognize
 *   evaluate_science_answer → science-solver-svc  /api/science-solver/analyze
 *   score_pronunciation     → speech-eval-svc     /api/speech-eval/evaluate (multipart)
 *   break_down_task         → @aivo/executive-function breakDownTask (in-process)
 *
 * Adapter rules:
 *   - NEVER throw a turn: every failure (timeout, 4xx/5xx, missing input)
 *     resolves to `{ error: "<actionable reason>" }` so the model simply
 *     sees that its instrument failed and decides without it.
 *   - Outputs are COMPACT: arrays capped, free text truncated — tool
 *     results ride inside the turn prompt and must not blow the envelope.
 *   - No fabricated assessment: when a backing service refuses (e.g.
 *     speech-eval 503 without an ASR provider) the refusal is passed
 *     through as an error, never converted into scores.
 */
import { breakDownTask } from "@aivo/executive-function";
import type { LessonObservation } from "./orchestrator.js";

export interface DomainToolContext {
  learnerId: string;
  observation: LessonObservation;
}

export interface DomainToolDeps {
  mathRecognizerUrl?: string;
  scienceSolverUrl?: string;
  speechEvalUrl?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2_500;

function urls(deps: DomainToolDeps) {
  return {
    math: deps.mathRecognizerUrl ?? process.env.MATH_RECOGNIZER_SVC_URL ?? "http://localhost:3030",
    science: deps.scienceSolverUrl ?? process.env.SCIENCE_SOLVER_SVC_URL ?? "http://localhost:3031",
    speech: deps.speechEvalUrl ?? process.env.SPEECH_EVAL_SVC_URL ?? "http://localhost:3032",
  };
}

const clip = (v: unknown, max = 240): string => String(v ?? "").slice(0, max);
const cap = <T>(arr: T[] | undefined, n = 5): T[] => (Array.isArray(arr) ? arr.slice(0, n) : []);

/** JSON schemas advertised to the model for the domain tools. */
export const DOMAIN_TOOL_SCHEMAS: Record<
  string,
  { description: string; parameters: Record<string, unknown> }
> = {
  read_math_work: {
    description:
      "Analyse the learner's math work on the current item (typed work or final answer): recognised steps, misconceptions, and correctness.",
    parameters: {
      type: "object",
      properties: {
        typed_work: { type: "string", description: "The learner's written working, if different from the final answer." },
        final_answer: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  evaluate_science_answer: {
    description:
      "Analyse the learner's science response for reasoning type, strengths, missing elements, and misconception candidates.",
    parameters: {
      type: "object",
      properties: {
        response: { type: "string", description: "Defaults to the learner's current answer." },
        topic: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  score_pronunciation: {
    description:
      "Score a learner voice recording against a target phrase (pronunciation + fluency per word). Requires audio from a voice surface.",
    parameters: {
      type: "object",
      properties: {
        target_text: { type: "string" },
        language: { type: "string", description: "BCP-47, default en-US." },
        audio_base64: { type: "string", description: "Recording from the current voice surface." },
        audio_mime: { type: "string", description: "e.g. audio/webm; default audio/webm." },
      },
      required: ["target_text"],
      additionalProperties: false,
    },
  },
  break_down_task: {
    description:
      "Break the current task into small, modality-tagged steps (executive-function scaffold) for a learner who is stuck on getting started.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task to break down; defaults to the current prompt." },
        modalities: {
          type: "array",
          items: { type: "string", enum: ["visual", "auditory", "kinesthetic", "reading"] },
          description: "Narrow steps to modalities the learner can use.",
        },
      },
      additionalProperties: false,
    },
  },
};

async function postJson(
  url: string,
  body: Record<string, unknown>,
  deps: DomainToolDeps,
): Promise<Record<string, unknown>> {
  const doFetch = deps.fetchImpl ?? fetch;
  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${detail.slice(0, 160)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function readMathWork(
  args: Record<string, unknown>,
  ctx: DomainToolContext,
  deps: DomainToolDeps,
): Promise<Record<string, unknown>> {
  const out = await postJson(
    `${urls(deps).math}/api/math-recognizer/recognize`,
    {
      learnerId: ctx.learnerId,
      subject: "math",
      skillCode: ctx.observation.skillId,
      prompt: ctx.observation.prompt,
      expectedAnswer: ctx.observation.expectedAnswer,
      finalAnswer: clip(args.final_answer ?? ctx.observation.learnerResponse, 500),
      typedWork:
        typeof args.typed_work === "string" && args.typed_work
          ? clip(args.typed_work, 1_000)
          : clip(ctx.observation.learnerResponse, 1_000),
    },
    deps,
  );
  return {
    recognized_expression: clip(out.recognizedExpression, 200) || undefined,
    steps: cap(out.recognizedSteps as Array<{ type?: unknown; value?: unknown }>).map((s) => ({
      type: clip(s.type, 30),
      value: clip(s.value, 120),
    })),
    misconceptions: cap(
      out.misconceptions as Array<{ label?: unknown; evidence?: unknown }>,
    ).map((m) => ({ label: clip(m.label, 80), evidence: clip(m.evidence, 160) })),
    correctness: typeof out.correctness === "boolean" ? out.correctness : null,
    confidence: typeof out.confidence === "number" ? out.confidence : null,
    feedback_hint: clip(out.feedbackHint, 200) || undefined,
  };
}

async function evaluateScienceAnswer(
  args: Record<string, unknown>,
  ctx: DomainToolContext,
  deps: DomainToolDeps,
): Promise<Record<string, unknown>> {
  const out = await postJson(
    `${urls(deps).science}/api/science-solver/analyze`,
    {
      learnerId: ctx.learnerId,
      prompt: ctx.observation.prompt,
      response:
        typeof args.response === "string" && args.response
          ? clip(args.response, 1_000)
          : clip(ctx.observation.learnerResponse, 1_000),
      topic: typeof args.topic === "string" ? clip(args.topic, 100) : undefined,
    },
    deps,
  );
  return {
    reasoning_type: clip(out.reasoningType, 40),
    observed_strengths: cap(out.observedStrengths as string[]).map((s) => clip(s, 120)),
    missing_elements: cap(out.missingElements as string[]).map((s) => clip(s, 120)),
    misconception_candidates: cap(out.misconceptionCandidates as string[]).map((s) =>
      clip(s, 120),
    ),
    next_hint: clip(out.nextHint, 200),
    confidence: typeof out.confidence === "number" ? out.confidence : null,
  };
}

async function scorePronunciation(
  args: Record<string, unknown>,
  ctx: DomainToolContext,
  deps: DomainToolDeps,
): Promise<Record<string, unknown>> {
  const targetText = typeof args.target_text === "string" ? args.target_text.trim() : "";
  if (!targetText) return { error: "target_text is required" };
  const audioB64 = typeof args.audio_base64 === "string" ? args.audio_base64 : "";
  if (!audioB64) {
    return {
      error:
        "no audio available — score_pronunciation needs a recording from a voice surface; present_surface voice_response first",
    };
  }
  let audio: Buffer;
  try {
    audio = Buffer.from(audioB64, "base64");
  } catch {
    return { error: "audio_base64 is not valid base64" };
  }
  if (audio.length === 0) return { error: "audio recording is empty" };

  const form = new FormData();
  const mime = typeof args.audio_mime === "string" && args.audio_mime ? args.audio_mime : "audio/webm";
  form.append("audio", new Blob([new Uint8Array(audio)], { type: mime }), "recording.webm");
  form.append("targetText", targetText.slice(0, 500));
  form.append(
    "language",
    typeof args.language === "string" && args.language ? args.language.slice(0, 20) : "en-US",
  );

  const doFetch = deps.fetchImpl ?? fetch;
  const res = await doFetch(`${urls(deps).speech}/api/speech-eval/evaluate`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 503 = ASR refused; surface the refusal honestly, never invent scores.
    throw new Error(`${res.status}: ${detail.slice(0, 160)}`);
  }
  const out = (await res.json()) as Record<string, unknown>;
  const scores = (out.scores ?? {}) as Record<string, unknown>;
  return {
    transcript: clip(out.transcript, 300),
    pronunciation: typeof scores.pronunciation === "number" ? scores.pronunciation : null,
    fluency: typeof scores.fluency === "number" ? scores.fluency : null,
    per_word: cap(scores.perWord as Array<{ word?: unknown; score?: unknown }>, 12).map((w) => ({
      word: clip(w.word, 40),
      score: typeof w.score === "number" ? w.score : null,
    })),
    degraded: out.degraded === true,
  };
}

const EF_MODALITIES = new Set(["visual", "auditory", "kinesthetic", "reading"]);

function breakDownTaskTool(
  args: Record<string, unknown>,
  ctx: DomainToolContext,
): Record<string, unknown> {
  const title = clip(
    typeof args.title === "string" && args.title.trim() ? args.title : ctx.observation.prompt,
    255,
  );
  if (!title) return { error: "no task title available to break down" };
  const taskId = `agent-${ctx.observation.skillId ?? "task"}-${ctx.observation.beatIndex}`;
  const base = breakDownTask({ taskId, title });
  // Same narrowing rule as the EF route: filter to allowed modalities,
  // fall back to the full plan if the filter would empty it.
  const allow = Array.isArray(args.modalities)
    ? new Set(args.modalities.map(String).filter((m) => EF_MODALITIES.has(m)))
    : null;
  const steps =
    allow && allow.size > 0
      ? (() => {
          const narrowed = base.steps.filter((s) => !s.modality || allow.has(s.modality));
          return narrowed.length > 0 ? narrowed : base.steps;
        })()
      : base.steps;
  return {
    task_id: taskId,
    steps: steps.map((s) => ({
      label: clip(s.label, 160),
      modality: s.modality ?? null,
      weight: s.weight,
    })),
    total_weight: steps.reduce((a, s) => a + s.weight, 0),
  };
}

export const DOMAIN_TOOL_NAMES = [
  "read_math_work",
  "evaluate_science_answer",
  "score_pronunciation",
  "break_down_task",
] as const;

/**
 * Execute one domain tool. Resolves to `{ error }` on every failure —
 * a flaky instrument must never kill the turn.
 */
export async function executeDomainTool(
  name: string,
  args: Record<string, unknown>,
  ctx: DomainToolContext,
  deps: DomainToolDeps = {},
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case "read_math_work":
        return await readMathWork(args, ctx, deps);
      case "evaluate_science_answer":
        return await evaluateScienceAnswer(args, ctx, deps);
      case "score_pronunciation":
        return await scorePronunciation(args, ctx, deps);
      case "break_down_task":
        return breakDownTaskTool(args, ctx);
      default:
        return { error: `unknown domain tool "${name}"` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
