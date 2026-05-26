/**
 * Azure Speech Services pronunciation assessment provider (Sprint 12.5).
 *
 * Calls the documented "REST API for short audio" with the
 * `Pronunciation-Assessment` header so the response includes per-word
 * AccuracyScore + FluencyScore. See:
 *   https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short
 *   https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
 *
 * Env:
 *   SPEECH_EVAL_AZURE_KEY    - required, Speech subscription key
 *   SPEECH_EVAL_AZURE_REGION - required, e.g. "eastus"
 */
import type {
  EvalOptions,
  EvalResult,
  PerWordScore,
  SpeechEvalProvider,
} from "./index.js";

export interface AzureProviderOptions {
  apiKey?: string;
  region?: string;
  fetchImpl?: typeof fetch;
}

interface AzureNbestEntry {
  PronunciationAssessment?: {
    AccuracyScore?: number;
    FluencyScore?: number;
  };
  Words?: Array<{
    Word: string;
    PronunciationAssessment?: { AccuracyScore?: number };
  }>;
  Display?: string;
  Lexical?: string;
}

interface AzureResponse {
  RecognitionStatus?: string;
  DisplayText?: string;
  NBest?: AzureNbestEntry[];
  Duration?: number;
}

export class AzureSpeechEvalProvider implements SpeechEvalProvider {
  readonly name = "azure" as const;
  private readonly apiKey: string;
  private readonly region: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AzureProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.SPEECH_EVAL_AZURE_KEY ?? "";
    this.region = options.region ?? process.env.SPEECH_EVAL_AZURE_REGION ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.apiKey || !this.region) {
      throw new Error(
        "AzureSpeechEvalProvider: SPEECH_EVAL_AZURE_KEY and SPEECH_EVAL_AZURE_REGION are required",
      );
    }
  }

  async evaluate(
    audio: Buffer,
    expectedText: string,
    opts: EvalOptions,
  ): Promise<EvalResult> {
    const assessmentParams = {
      ReferenceText: expectedText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      EnableMiscue: "True",
    };
    const assessmentHeader = Buffer.from(JSON.stringify(assessmentParams)).toString(
      "base64",
    );

    const url = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(opts.language)}&format=detailed`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          "Content-Type": opts.contentType ?? "audio/wav; codecs=audio/pcm; samplerate=16000",
          Accept: "application/json",
          "Pronunciation-Assessment": assessmentHeader,
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
        `azure ASR failed: ${response.status} ${response.statusText} ${body.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as AzureResponse;
    if (payload.RecognitionStatus && payload.RecognitionStatus !== "Success") {
      throw new Error(`azure ASR status=${payload.RecognitionStatus}`);
    }

    const best = payload.NBest?.[0];
    const transcript = best?.Display ?? best?.Lexical ?? payload.DisplayText ?? "";
    const pronunciation = Math.round(best?.PronunciationAssessment?.AccuracyScore ?? 0);
    const fluency = Math.round(best?.PronunciationAssessment?.FluencyScore ?? 0);
    const perWord: PerWordScore[] = (best?.Words ?? []).map((w) => ({
      word: w.Word,
      score: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
    }));

    return {
      transcript,
      scores: { pronunciation, fluency, perWord },
      degraded: false,
      language: opts.language,
      // Azure encodes Duration in 100-ns ticks.
      durationMs:
        typeof payload.Duration === "number"
          ? Math.round(payload.Duration / 10_000)
          : undefined,
    };
  }
}
