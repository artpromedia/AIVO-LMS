/**
 * ASR provider interface (Sprint F — completion plan).
 *
 * Splits the speech-eval-svc evaluate route from a specific transcription
 * backend. The route picks a provider via env at request time and falls
 * back to the mock scorer when no provider is configured.
 *
 *   ASR_PROVIDER=openai   → OpenAiWhisperProvider (uses OPENAI_API_KEY)
 *   ASR_PROVIDER=azure    → AzureSpeechProvider   (uses AZURE_SPEECH_KEY +
 *                                                   AZURE_SPEECH_REGION)
 *   ASR_PROVIDER unset    → NullProvider (returns `unavailable`, caller
 *                                          falls back to the mock scorer)
 *
 * Every provider must return either an `ok` transcript or `unavailable` —
 * provider errors never throw out of `transcribe()`. The route stays
 * non-blocking for learners: bad-network → mock scores → lesson advances.
 */

export interface AsrTranscript {
  text: string;
  language: string;
  durationMs?: number;
}

export type AsrResult =
  | { status: "ok"; transcript: AsrTranscript; provider: string }
  | { status: "unavailable"; provider: string; reason: string };

export interface AsrInput {
  /** Raw audio bytes (webm / mp4 / ogg / wav). */
  audio: Buffer;
  /** Original mimetype as advertised by the multipart upload. */
  mimetype: string;
  /** Optional original filename — Whisper uses the extension as a hint. */
  filename?: string;
  /** BCP-47 language code. */
  language: string;
}

export interface AsrProvider {
  readonly name: string;
  transcribe(input: AsrInput): Promise<AsrResult>;
}

class NullProvider implements AsrProvider {
  readonly name = "null";
  async transcribe(): Promise<AsrResult> {
    return { status: "unavailable", provider: this.name, reason: "no_provider_configured" };
  }
}

class OpenAiWhisperProvider implements AsrProvider {
  readonly name = "openai-whisper";
  private readonly baseUrl: string;
  private readonly model: string;
  constructor(
    private readonly apiKey: string,
    opts: { baseUrl?: string; model?: string } = {},
  ) {
    this.baseUrl = opts.baseUrl ?? "https://api.openai.com/v1";
    this.model = opts.model ?? "whisper-1";
  }

  async transcribe(input: AsrInput): Promise<AsrResult> {
    try {
      const form = new FormData();
      const filename = input.filename ?? guessFilename(input.mimetype);
      // node's Blob requires a Uint8Array (not a Node Buffer) typing-wise.
      const blob = new Blob([new Uint8Array(input.audio)], { type: input.mimetype });
      form.append("file", blob, filename);
      form.append("model", this.model);
      form.append("language", normalizeLanguage(input.language));
      form.append("response_format", "json");

      const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return {
          status: "unavailable",
          provider: this.name,
          reason: `http_${res.status}`,
        };
      }
      const json = (await res.json()) as { text?: string; duration?: number };
      const text = (json.text ?? "").trim();
      if (!text) {
        return { status: "unavailable", provider: this.name, reason: "empty_transcript" };
      }
      return {
        status: "ok",
        provider: this.name,
        transcript: {
          text,
          language: input.language,
          durationMs:
            typeof json.duration === "number" ? Math.round(json.duration * 1000) : undefined,
        },
      };
    } catch (err) {
      return {
        status: "unavailable",
        provider: this.name,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

class AzureSpeechProvider implements AsrProvider {
  readonly name = "azure-speech";
  constructor(
    private readonly apiKey: string,
    private readonly region: string,
  ) {}

  async transcribe(input: AsrInput): Promise<AsrResult> {
    try {
      const url = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(
        normalizeLanguage(input.language),
      )}&format=detailed`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          "Content-Type": input.mimetype,
          Accept: "application/json",
        },
        body: new Uint8Array(input.audio),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return {
          status: "unavailable",
          provider: this.name,
          reason: `http_${res.status}`,
        };
      }
      const json = (await res.json()) as {
        DisplayText?: string;
        Duration?: number;
      };
      const text = (json.DisplayText ?? "").trim();
      if (!text) {
        return { status: "unavailable", provider: this.name, reason: "empty_transcript" };
      }
      return {
        status: "ok",
        provider: this.name,
        transcript: {
          text,
          language: input.language,
          // Azure reports Duration in 100-nanosecond ticks.
          durationMs:
            typeof json.Duration === "number" ? Math.round(json.Duration / 10_000) : undefined,
        },
      };
    } catch (err) {
      return {
        status: "unavailable",
        provider: this.name,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

function normalizeLanguage(lang: string): string {
  // Whisper wants ISO-639-1 only ("en"), Azure wants BCP-47 ("en-US").
  // Pass BCP-47 through unchanged; the providers map internally.
  return lang || "en-US";
}

function guessFilename(mime: string): string {
  if (mime.includes("webm")) return "audio.webm";
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "audio.m4a";
  if (mime.includes("wav")) return "audio.wav";
  return "audio.bin";
}

let _instance: AsrProvider | null = null;

export function getAsrProvider(): AsrProvider {
  if (_instance) return _instance;
  const provider = (process.env.ASR_PROVIDER ?? "").trim().toLowerCase();
  switch (provider) {
    case "openai":
    case "openai-whisper": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        _instance = new NullProvider();
        return _instance;
      }
      _instance = new OpenAiWhisperProvider(key, {
        baseUrl: process.env.OPENAI_API_BASE_URL,
        model: process.env.WHISPER_MODEL,
      });
      return _instance;
    }
    case "azure":
    case "azure-speech": {
      const key = process.env.AZURE_SPEECH_KEY;
      const region = process.env.AZURE_SPEECH_REGION;
      if (!key || !region) {
        _instance = new NullProvider();
        return _instance;
      }
      _instance = new AzureSpeechProvider(key, region);
      return _instance;
    }
    default:
      _instance = new NullProvider();
      return _instance;
  }
}

/** Test seam — reset cached singleton. */
export function __resetAsrProvider(): void {
  _instance = null;
}
