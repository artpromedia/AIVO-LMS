/**
 * Speech-eval provider factory (Sprint 12.5).
 *
 * Selects the implementation named by `SPEECH_EVAL_PROVIDER`:
 *   "whisper"  -> WhisperSpeechEvalProvider (requires SPEECH_EVAL_WHISPER_API_KEY)
 *   "azure"    -> AzureSpeechEvalProvider   (requires SPEECH_EVAL_AZURE_KEY + REGION)
 *   "deepgram" -> DeepgramSpeechEvalProvider (requires SPEECH_EVAL_DEEPGRAM_KEY)
 *   "mock"     -> MockSpeechEvalProvider     (dev/test only)
 *
 * Production hard-fail: if `NODE_ENV === "production"` and the provider
 * resolves to "mock" (either explicitly set or unset), throw at boot so
 * the orchestrator restart-loops loudly instead of serving mock scores.
 */
import type { SpeechEvalProvider } from "./index.js";
import { MockSpeechEvalProvider } from "./mock.js";
import { WhisperSpeechEvalProvider } from "./whisper.js";
import { AzureSpeechEvalProvider } from "./azure.js";
import { DeepgramSpeechEvalProvider } from "./deepgram.js";

let cached: SpeechEvalProvider | null = null;

export interface FactoryOptions {
  /** Override the env var lookup; useful for tests. */
  providerName?: string;
  /** Force a fresh resolve (bypass module-level cache). */
  fresh?: boolean;
}

export function resetProviderCache(): void {
  cached = null;
}

export function getSpeechEvalProvider(options: FactoryOptions = {}): SpeechEvalProvider {
  if (cached && !options.fresh) return cached;

  const requested = (options.providerName ?? process.env.SPEECH_EVAL_PROVIDER ?? "").trim().toLowerCase();
  const effective = requested || "mock";

  if (process.env.NODE_ENV === "production" && effective === "mock") {
    throw new Error(
      "speech-eval-svc: SPEECH_EVAL_PROVIDER=mock (or unset) is not " +
        "permitted in production. Set SPEECH_EVAL_PROVIDER to whisper, " +
        "azure, or deepgram and supply the matching API credentials.",
    );
  }

  let provider: SpeechEvalProvider;
  switch (effective) {
    case "whisper":
      provider = new WhisperSpeechEvalProvider();
      break;
    case "azure":
      provider = new AzureSpeechEvalProvider();
      break;
    case "deepgram":
      provider = new DeepgramSpeechEvalProvider();
      break;
    case "mock":
      provider = new MockSpeechEvalProvider();
      break;
    default:
      throw new Error(
        `speech-eval-svc: unknown SPEECH_EVAL_PROVIDER="${effective}". ` +
          `Expected one of whisper | azure | deepgram | mock.`,
      );
  }

  cached = provider;
  return provider;
}
