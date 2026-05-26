/**
 * OpenAI Whisper provider for speech evaluation (Sprint 12.5).
 *
 * Calls the documented audio-transcription endpoint
 * (https://platform.openai.com/docs/api-reference/audio/createTranscription)
 * with multipart form data. Whisper returns the transcript only;
 * per-word pronunciation scoring is derived locally by comparing the
 * transcript to the expected text token-by-token. This keeps the
 * provider's wire surface minimal — a phoneme-alignment scorer can be
 * added later behind the same `SpeechEvalProvider` interface.
 *
 * Env:
 *   SPEECH_EVAL_WHISPER_API_KEY  - required, OpenAI bearer token
 *   SPEECH_EVAL_WHISPER_BASE_URL - optional, defaults to
 *                                  https://api.openai.com/v1
 *   SPEECH_EVAL_WHISPER_MODEL    - optional, defaults to whisper-1
 */
import type {
  EvalOptions,
  EvalResult,
  PerWordScore,
  SpeechEvalProvider,
} from "./index.js";
import { scoreTranscriptAgainstExpected } from "./scoring.js";

export interface WhisperProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** Inject a fetch implementation for testing. */
  fetchImpl?: typeof fetch;
}

export class WhisperSpeechEvalProvider implements SpeechEvalProvider {
  readonly name = "whisper" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WhisperProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.SPEECH_EVAL_WHISPER_API_KEY ?? "";
    this.baseUrl = (options.baseUrl ?? process.env.SPEECH_EVAL_WHISPER_BASE_URL ?? "https://api.openai.com/v1")
      .replace(/\/$/, "");
    this.model = options.model ?? process.env.SPEECH_EVAL_WHISPER_MODEL ?? "whisper-1";
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (!this.apiKey) {
      throw new Error(
        "WhisperSpeechEvalProvider: SPEECH_EVAL_WHISPER_API_KEY is required",
      );
    }
  }

  async evaluate(
    audio: Buffer,
    expectedText: string,
    opts: EvalOptions,
  ): Promise<EvalResult> {
    const form = new FormData();
    const blob = new Blob([audio], {
      type: opts.contentType ?? "audio/webm",
    });
    form.append("file", blob, "audio.webm");
    form.append("model", this.model);
    // BCP-47 → ISO-639-1 ("en-US" → "en") for Whisper's language hint.
    const langHint = (opts.language || "en").split("-")[0];
    if (langHint) form.append("language", langHint);
    form.append("response_format", "json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `whisper ASR failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as { text?: string; duration?: number };
    const transcript = (payload.text ?? "").trim();
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
      durationMs: payload.duration ? Math.round(payload.duration * 1000) : undefined,
    };
  }
}
