/**
 * Speech evaluation provider abstraction (Sprint 12.5).
 *
 * Every concrete provider (Whisper, Azure Speech, Deepgram, the mock
 * scorer used in dev/test) implements this single interface so the
 * /api/speech-eval/evaluate route can be provider-agnostic. The factory
 * in `./factory.ts` selects an implementation based on
 * `SPEECH_EVAL_PROVIDER` and refuses to boot in production with the
 * mock provider.
 */

export interface EvalOptions {
  /** BCP-47 language code, e.g. "en-US", "es-MX". */
  language: string;
  /** Optional MIME hint for the audio buffer (e.g. "audio/webm"). */
  contentType?: string;
  /** Per-call timeout override in milliseconds. */
  timeoutMs?: number;
}

export interface PerWordScore {
  word: string;
  /** 0-100 pronunciation score for this word. */
  score: number;
}

export interface EvalResult {
  /** ASR transcript of the learner audio. */
  transcript: string;
  scores: {
    /** Overall pronunciation accuracy, 0-100. */
    pronunciation: number;
    /** Overall fluency, 0-100 (pace + smoothness). */
    fluency: number;
    /** Optional per-word breakdown (provider-dependent). */
    perWord?: PerWordScore[];
  };
  /** true when the call returned mock / heuristic data, not real ASR. */
  degraded: boolean;
  language: string;
  durationMs?: number;
}

export interface SpeechEvalProvider {
  /** Stable provider id; matches what `SPEECH_EVAL_PROVIDER` accepts. */
  readonly name: "whisper" | "azure" | "deepgram" | "mock";
  /** Evaluate a single audio recording against the expected text. */
  evaluate(audio: Buffer, expectedText: string, opts: EvalOptions): Promise<EvalResult>;
}
