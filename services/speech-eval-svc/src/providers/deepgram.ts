/**
 * Deepgram Nova-3 speech-to-text provider (Sprint 12.5).
 *
 * Deepgram's REST API accepts raw audio in the request body and returns
 * a JSON transcript with per-word confidence. We use the transcript +
 * the local scoring helper to derive pronunciation/fluency in the same
 * shape as the other providers. See:
 *   https://developers.deepgram.com/reference/listen-file
 *
 * Env:
 *   SPEECH_EVAL_DEEPGRAM_KEY   - required, Deepgram API key
 *   SPEECH_EVAL_DEEPGRAM_MODEL - optional, defaults to "nova-3-general"
 */
import type {
  EvalOptions,
  EvalResult,
  PerWordScore,
  SpeechEvalProvider,
} from "./index.js";
import { scoreTranscriptAgainstExpected } from "./scoring.js";

export interface DeepgramProviderOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

interface DeepgramAlternative {
  transcript?: string;
  confidence?: number;
  words?: Array<{
    word: string;
    start?: number;
    end?: number;
    confidence?: number;
  }>;
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{ alternatives?: DeepgramAlternative[] }>;
  };
  metadata?: { duration?: number };
}

export class DeepgramSpeechEvalProvider implements SpeechEvalProvider {
  readonly name = "deepgram" as const;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepgramProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.SPEECH_EVAL_DEEPGRAM_KEY ?? "";
    this.model = options.model ?? process.env.SPEECH_EVAL_DEEPGRAM_MODEL ?? "nova-3-general";
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.apiKey) {
      throw new Error(
        "DeepgramSpeechEvalProvider: SPEECH_EVAL_DEEPGRAM_KEY is required",
      );
    }
  }

  async evaluate(
    audio: Buffer,
    expectedText: string,
    opts: EvalOptions,
  ): Promise<EvalResult> {
    const params = new URLSearchParams({
      model: this.model,
      language: opts.language || "en-US",
      smart_format: "true",
      punctuate: "true",
    });
    const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": opts.contentType ?? "audio/webm",
        },
        body: audio,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `deepgram ASR failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as DeepgramResponse;
    const best = payload.results?.channels?.[0]?.alternatives?.[0];
    const transcript = (best?.transcript ?? "").trim();
    const { pronunciation, fluency, perWord } = scoreTranscriptAgainstExpected(
      transcript,
      expectedText,
    );

    return {
      transcript,
      scores: {
        pronunciation,
        fluency,
        perWord: perWord as PerWordScore[],
      },
      degraded: false,
      language: opts.language,
      durationMs: payload.metadata?.duration
        ? Math.round(payload.metadata.duration * 1000)
        : undefined,
    };
  }
}
